const express = require('express');
const sqlite3 = require('sqlite3').verbose();
// Tạo short ID thay vì UUID dài
function generateShortId() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Tạo custom path từ tên link
function createFriendlyPath(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Loại bỏ ký tự đặc biệt
    .replace(/\s+/g, '-') // Thay space bằng dấu gạch
    .replace(/-+/g, '-') // Loại bỏ dấu gạch liên tiếp
    .slice(0, 20); // Giới hạn độ dài
}
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// API Configuration
const APIIP_KEY = '8ddc638d-4e0f-4185-b648-782c978f9aa2';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Khởi tạo database
const db = new sqlite3.Database('tracking.db');

// Chạy migration
migrateDatabase();

// Tạo bảng nếu chưa tồn tại
db.run(`
  CREATE TABLE IF NOT EXISTS tracking_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT UNIQUE,
    short_path TEXT UNIQUE,
    name TEXT,
    original_url TEXT,
    custom_domain TEXT,
    preview_enabled BOOLEAN DEFAULT 1,
    password TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    latitude REAL,
    longitude REAL,
    country TEXT,
    city TEXT,
    region TEXT,
    timezone TEXT,
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES tracking_links (link_id)
  )
`);

// Migration function để cập nhật database schema
function migrateDatabase() {
  // Checking database schema silently
  
  // Tạo bảng migration để track các migration đã chạy
  db.run(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY,
    migration_name TEXT UNIQUE,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Kiểm tra xem migration đã chạy chưa
  db.get("SELECT * FROM migrations WHERE migration_name = 'add_columns_v1'", (err, migration) => {
    if (err) {
      console.error('Error checking migration:', err);
      return;
    }
    
    if (migration) {
      // Migration already completed
      return;
    }
    
    // Chạy migration an toàn
    // Running database migration silently
    
    // Function để thêm cột an toàn
    const addColumnSafely = (columnName, columnDef, callback) => {
      db.get(`PRAGMA table_info(tracking_links)`, (err, result) => {
        if (err) {
          console.error(`Error checking column ${columnName}:`, err);
          return callback && callback();
        }
        
        // Kiểm tra xem cột đã tồn tại chưa
        db.all(`PRAGMA table_info(tracking_links)`, (err, columns) => {
          if (err) return callback && callback();
          
          const columnExists = columns.some(col => col.name === columnName);
          
          if (!columnExists) {
            console.log(`➕ Adding ${columnName} column...`);
            db.run(`ALTER TABLE tracking_links ADD COLUMN ${columnName} ${columnDef}`, (err) => {
              if (err && !err.message.includes('duplicate column name')) {
                console.error(`Error adding ${columnName}:`, err);
              }
              callback && callback();
            });
          } else {
            console.log(`✅ Column ${columnName} already exists`);
            callback && callback();
          }
        });
      });
    };
    
    // Thêm từng cột một cách an toàn
    addColumnSafely('short_path', 'TEXT', () => {
      addColumnSafely('custom_domain', 'TEXT', () => {
        addColumnSafely('preview_enabled', 'BOOLEAN DEFAULT 1', () => {
          addColumnSafely('password', 'TEXT', () => {
            addColumnSafely('expires_at', 'DATETIME', () => {
              // Đánh dấu migration đã hoàn thành
              db.run("INSERT OR IGNORE INTO migrations (migration_name) VALUES ('add_columns_v1')", (err) => {
                if (!err) {
                  console.log('✅ Migration completed successfully');
                  migrateExistingLinks();
                }
              });
            });
          });
        });
      });
    });
  });
}

function migrateExistingLinks() {
  console.log('🔄 Migrating existing links...');
  
  // Cập nhật các link cũ để có short_path
  db.all("SELECT * FROM tracking_links WHERE short_path IS NULL", (err, links) => {
    if (err) {
      console.error('Error fetching links for migration:', err);
      return;
    }
    
    links.forEach(link => {
      const shortPath = createFriendlyPath(link.name) + '-' + generateShortId().slice(0, 3);
      
      db.run(
        "UPDATE tracking_links SET short_path = ?, preview_enabled = 1 WHERE id = ?",
        [shortPath, link.id],
        (err) => {
          if (err) {
            console.error(`Error migrating link ${link.id}:`, err);
          } else {
            console.log(`✅ Migrated link: ${link.name} -> /${shortPath}`);
          }
        }
      );
    });
  });
}


// Hàm lấy thông tin IP với API apiip.net chính xác cao
async function getIPInfo(ip) {
  try {
    // API 1: apiip.net - API premium với key riêng, rất chính xác cho Việt Nam
    const response1 = await axios.get(`https://apiip.net/api/check?ip=${ip}&accessKey=${APIIP_KEY}`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response1.data && response1.data.city && !response1.data.error) {
      const result = {
        latitude: response1.data.latitude,
        longitude: response1.data.longitude,
        city: response1.data.city,
        region: response1.data.regionName || response1.data.region,
        country_name: response1.data.countryName,
        country_code: response1.data.countryCode,
        timezone: response1.data.timeZone,
        isp: response1.data.isp,
        source: 'apiip.net'
      };
      
      console.log(`✅ apiip.net result: ${result.city}, ${result.region}`);
      return result;
    }
  } catch (error) {
    console.log('apiip.net failed, trying backup API...');
  }

  try {
    // API 2: ipapi.co - Backup
    const response2 = await axios.get(`https://ipapi.co/${ip}/json/`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response2.data && response2.data.city && !response2.data.error) {
      const result = {
        latitude: response2.data.latitude,
        longitude: response2.data.longitude,
        city: response2.data.city,
        region: response2.data.region,
        country_name: response2.data.country_name,
        country_code: response2.data.country_code,
        timezone: response2.data.timezone,
        isp: response2.data.org,
        source: 'ipapi.co'
      };
      
      console.log(`✅ ipapi.co result: ${result.city}, ${result.region}`);
      return result;
    }
  } catch (error) {
    console.log('ipapi.co failed, trying final backup...');
  }

  try {
    // API 3: ip-api.com - Final backup
    const response3 = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org`, {
      timeout: 5000
    });
    
    if (response3.data && response3.data.status === 'success') {
      const result = {
        latitude: response3.data.lat,
        longitude: response3.data.lon,
        city: response3.data.city,
        region: response3.data.regionName,
        country_name: response3.data.country,
        country_code: response3.data.countryCode,
        timezone: response3.data.timezone,
        isp: response3.data.isp || response3.data.org,
        source: 'ip-api.com'
      };
      
      console.log(`✅ ip-api.com result: ${result.city}, ${result.region}`);
      return result;
    }
  } catch (error) {
    console.log('All IP location APIs failed');
  }

  return null;
}

// Routes
// Trang chủ - Dashboard
app.get('/', (req, res) => {
  db.all(`
    SELECT tl.*, COUNT(v.id) as visit_count 
    FROM tracking_links tl 
    LEFT JOIN visits v ON tl.link_id = v.link_id 
    GROUP BY tl.id 
    ORDER BY tl.created_at DESC
  `, (err, links) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    
    // Tạo tracking URL cho mỗi link
    links.forEach(link => {
      link.tracking_url = `${req.protocol}://${req.get('host')}/${link.short_path}`;
      link.is_expired = link.expires_at && new Date() > new Date(link.expires_at);
    });
    
    res.render('dashboard', { links, req });
  });
});

// API tạo link mới với options nâng cao
app.post('/api/create-link', (req, res) => {
  const { name, originalUrl, customPath, customDomain, enablePreview, password, expiresIn } = req.body;
  const linkId = generateShortId();
  
  // Tạo friendly path
  let shortPath = customPath || createFriendlyPath(name) + '-' + generateShortId().slice(0, 3);
  
  // Xử lý domain
  const domain = customDomain || req.get('host');
  
  // Xử lý expiry
  let expiresAt = null;
  if (expiresIn && expiresIn > 0) {
    expiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString();
  }
    db.run(
    `INSERT INTO tracking_links 
     (link_id, short_path, name, original_url, custom_domain, preview_enabled, password, expires_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [linkId, shortPath, name, originalUrl, domain, 0, password || null, expiresAt],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          // Thử lại với path khác
          shortPath = createFriendlyPath(name) + '-' + generateShortId();
          db.run(
            `INSERT INTO tracking_links 
             (link_id, short_path, name, original_url, custom_domain, preview_enabled, password, expires_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [linkId, shortPath, name, originalUrl, domain, 0, password || null, expiresAt],
            function(err2) {
              if (err2) {
                console.error(err2);
                return res.status(500).json({ error: 'Database error' });
              }
              sendResponse();
            }
          );
        } else {
          console.error(err);
          return res.status(500).json({ error: 'Database error' });
        }
      } else {
        sendResponse();
      }
      
      function sendResponse() {
        const trackingUrl = `${req.protocol}://${domain}/${shortPath}`;
        const adminUrl = `${req.protocol}://${req.get('host')}/admin/${linkId}`;
        
        res.json({
          success: true,
          linkId,
          shortPath,
          trackingUrl,
          adminUrl,
          originalUrl,
          expiresAt
        });
      }
    }
  );
});

// Route tracking ngắn gọn và uy tín - /:shortPath
app.get('/:shortPath', async (req, res) => {
  const shortPath = req.params.shortPath;
    // Bỏ qua các route system
  if (['api', 'admin', 'track', 'details', 'favicon.ico', 'robots.txt'].includes(shortPath)) {
    return res.status(404).render('404');
  }
  
  // Lấy thông tin link
  db.get('SELECT * FROM tracking_links WHERE short_path = ?', [shortPath], async (err, link) => {
    if (err || !link) {
      return res.status(404).render('404', { shortPath });
    }
    
    // Kiểm tra expired
    if (link.expires_at && new Date() > new Date(link.expires_at)) {
      return res.status(410).render('expired', { link });
    }
    
    // Kiểm tra password
    if (link.password && req.query.pwd !== link.password) {
      return res.render('password', { link, shortPath });
    }
    
    await processTracking(req, res, link);
  });
});

// Route tracking cũ để backward compatibility
app.get('/track/:linkId', async (req, res) => {
  const linkId = req.params.linkId;
  
  db.get('SELECT * FROM tracking_links WHERE link_id = ?', [linkId], async (err, link) => {
    if (err || !link) {
      return res.status(404).send('Link not found');
    }
    
    await processTracking(req, res, link);
  });
});

// Hàm xử lý tracking chung
async function processTracking(req, res, link) {
    // Cải thiện cách lấy IP thật của user - ưu tiên IPv6 cho độ chính xác cao hơn
    let clientIP = null;
    let ipType = 'unknown';
    
    // Thử các header theo thứ tự ưu tiên
    const ipHeaders = [
      'cf-connecting-ip',          // Cloudflare
      'x-real-ip',                 // Nginx
      'x-forwarded-for',           // Load balancers
      'x-client-ip',               // Apache
      'x-forwarded',               // Proxy
      'x-cluster-client-ip',       // Cluster
      'forwarded-for',
      'forwarded'
    ];
    
    // Thu thập tất cả IP có thể từ headers
    let allPossibleIPs = [];
    
    for (const header of ipHeaders) {
      if (req.headers[header]) {
        // Xử lý trường hợp có nhiều IP trong header
        const ips = req.headers[header].split(',').map(ip => ip.trim());
        allPossibleIPs.push(...ips);
      }
    }
    
    // Thêm connection IP
    const connectionIP = req.connection.remoteAddress || 
                         req.socket.remoteAddress ||
                         (req.connection.socket ? req.connection.socket.remoteAddress : null);
    if (connectionIP) {
      allPossibleIPs.push(connectionIP);
    }
    
    // Loại bỏ IP trùng lặp
    allPossibleIPs = [...new Set(allPossibleIPs)];
    
    // Hàm kiểm tra IPv6 hợp lệ (không phải IPv4-mapped)
    const isValidIPv6 = (ip) => {
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      return ipv6Regex.test(ip) && !ip.startsWith('::ffff:');
    };
    
    // Hàm kiểm tra IPv4 hợp lệ
    const isValidIPv4 = (ip) => {
      const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
      return ipv4Regex.test(ip);
    };
    
    // Hàm kiểm tra IP private
    const isPrivateIP = (ip) => {
      if (ip === '::1' || ip === '127.0.0.1') return true;
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return true;
      if (ip.startsWith('fc00:') || ip.startsWith('fd00:') || ip.startsWith('fe80:')) return true;
      return false;
    };
    
    // Phân loại IP theo loại và ưu tiên
    let ipv6Candidates = [];
    let ipv4Candidates = [];
    
    for (let ip of allPossibleIPs) {
      // Xử lý IPv4 mapped trong IPv6
      if (ip.startsWith('::ffff:')) {
        const ipv4 = ip.substr(7);
        if (isValidIPv4(ipv4) && !isPrivateIP(ipv4)) {
          ipv4Candidates.push(ipv4);
        }
      } 
      // IPv6 thuần túy (không phải mapped)
      else if (isValidIPv6(ip) && !isPrivateIP(ip)) {
        ipv6Candidates.push(ip);
      } 
      // IPv4 thuần túy
      else if (isValidIPv4(ip) && !isPrivateIP(ip)) {
        ipv4Candidates.push(ip);
      }
    }
    
    // Ưu tiên IPv6 trước, sau đó đến IPv4
    if (ipv6Candidates.length > 0) {
      clientIP = ipv6Candidates[0];
      ipType = 'IPv6';
      console.log(`🌍 Using IPv6: ${clientIP} (enhanced accuracy expected)`);
    } else if (ipv4Candidates.length > 0) {
      clientIP = ipv4Candidates[0];
      ipType = 'IPv4';
      console.log(`🌍 Using IPv4: ${clientIP}`);
    } else {
      // Fallback về IP đầu tiên nếu không có IP public
      clientIP = allPossibleIPs[0];
      if (clientIP && clientIP.startsWith('::ffff:')) {
        clientIP = clientIP.substr(7);
      }
      ipType = isPrivateIP(clientIP) ? 'Private' : 'Fallback';
      console.log(`⚠️ Using fallback IP: ${clientIP} (${ipType})`);
    }    
    const userAgent = req.headers['user-agent'];
    
    // Lấy thông tin vị trí từ IP với độ chính xác cao hơn
    let ipInfo;
    if (clientIP === '::1' || clientIP === '127.0.0.1' || isPrivateIP(clientIP)) {
      // Sử dụng IP demo để test (IP của Google)
      ipInfo = await getIPInfo('8.8.8.8');
      if (ipInfo) {
        ipInfo.isDemo = true;
        ipInfo.realIP = clientIP;
      }
    } else {
      ipInfo = await getIPInfo(clientIP);
    }
    
    // Lưu thông tin visit
    const visitData = {
      link_id: link.link_id,
      ip_address: clientIP,
      user_agent: userAgent,
      latitude: ipInfo ? ipInfo.latitude : null,
      longitude: ipInfo ? ipInfo.longitude : null,
      country: ipInfo ? ipInfo.country_name : null,
      city: ipInfo ? ipInfo.city : null,
      region: ipInfo ? ipInfo.region : null,
      timezone: ipInfo ? ipInfo.timezone : null
    };
    
    db.run(`
      INSERT INTO visits (link_id, ip_address, user_agent, latitude, longitude, country, city, region, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)    `, Object.values(visitData), (err) => {
      // Âm thầm bỏ qua lỗi
    });
    
    // Redirect trực tiếp không hiển thị trang tracking để tránh bị phát hiện
    res.redirect(link.original_url);
}

// API lấy vị trí từ GPS (JavaScript geolocation)
app.post('/api/update-location', (req, res) => {
  const { linkId, latitude, longitude } = req.body;
  
  // Cập nhật vị trí GPS nếu có
  db.run(`
    UPDATE visits 
    SET latitude = ?, longitude = ? 
    WHERE link_id = ? AND visited_at = (
      SELECT MAX(visited_at) FROM visits WHERE link_id = ?
    )
  `, [latitude, longitude, linkId, linkId], (err) => {
    if (err) {
      console.error('Error updating location:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

// API lấy dữ liệu visits cho một link
app.get('/api/visits/:linkId', (req, res) => {
  const linkId = req.params.linkId;
  
  db.all('SELECT * FROM visits WHERE link_id = ? ORDER BY visited_at DESC', [linkId], (err, visits) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(visits);
  });
});

// Trang xem chi tiết một link
app.get('/details/:linkId', (req, res) => {
  const linkId = req.params.linkId;
  
  db.get('SELECT * FROM tracking_links WHERE link_id = ?', [linkId], (err, link) => {
    if (err || !link) {
      return res.status(404).send('Link not found');
    }
    
    db.all('SELECT * FROM visits WHERE link_id = ? ORDER BY visited_at DESC', [linkId], (err, visits) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      
      // Truyền req object vào template
      res.render('details', { link, visits, req });
    });
  });
});

// API để kiểm tra IP hiện tại với độ chính xác cao
app.get('/api/check-ip', async (req, res) => {
  // Sử dụng cùng logic với processTracking
  let clientIP = null;
  
  const ipHeaders = [
    'cf-connecting-ip',
    'x-real-ip',
    'x-forwarded-for',
    'x-client-ip',
    'x-forwarded',
    'x-cluster-client-ip',
    'forwarded-for',
    'forwarded'
  ];
  
  for (const header of ipHeaders) {
    if (req.headers[header]) {
      clientIP = req.headers[header];
      break;
    }
  }
  
  if (!clientIP) {
    clientIP = req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
  }
  
  if (clientIP && clientIP.includes(',')) {
    clientIP = clientIP.split(',')[0].trim();
  }
  
  if (clientIP && clientIP.substr(0, 7) === '::ffff:') {
    clientIP = clientIP.substr(7);
  }
    if (clientIP && clientIP.includes(':') && !clientIP.includes('::')) {
    clientIP = clientIP.split(':')[0];
  }
  
  // Lấy IP công khai thật từ service bên ngoài
  let publicIP = clientIP;
  try {
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
    publicIP = response.data.ip;
  } catch (error) {
    console.log('Could not get public IP:', error.message);
  }
    const ipInfo = await getIPInfo(publicIP);
  
  res.json({
    detectedIP: clientIP,
    publicIP: publicIP,
    isLocalhost: clientIP === '::1' || clientIP === '127.0.0.1' || clientIP.startsWith('192.168.') || clientIP.startsWith('10.') || clientIP.startsWith('172.'),
    locationInfo: ipInfo,
    headers: {
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'x-client-ip': req.headers['x-client-ip'],
      'user-agent': req.headers['user-agent']
    },
    allHeaders: req.headers
  });
});

// API test với IP thật
app.post('/api/test-real-ip', async (req, res) => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
    const realIP = response.data.ip;
    const ipInfo = await getIPInfo(realIP);
    
    res.json({
      success: true,
      realIP: realIP,
      locationInfo: ipInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API test location cho IP cụ thể
app.get('/api/test-location/:ip', async (req, res) => {
  const testIP = req.params.ip;
  
  try {
    console.log(`🧪 Testing location for IP: ${testIP}`);
    const locationInfo = await getIPInfo(testIP);
    
    res.json({
      success: true,
      ip: testIP,
      location: locationInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      ip: testIP
    });
  }
});

// API test IP location với IP cụ thể
app.get('/api/test-ip/:ip', async (req, res) => {
  const testIP = req.params.ip;
  console.log(`🧪 Testing IP location for: ${testIP}`);
  
  const result = await getIPInfo(testIP);
  
  res.json({
    ip: testIP,
    location: result,
    note: result?.corrected ? 'Location was corrected for Vietnamese IP' : 'Original API result'
  });
});

// API test apiip.net với IP cụ thể
app.get('/api/test-apiip/:ip', async (req, res) => {
  const testIP = req.params.ip;
  console.log(`🧪 Testing apiip.net for IP: ${testIP}`);
  
  try {
    const response = await axios.get(`https://apiip.net/api/check?ip=${testIP}&accessKey=${APIIP_KEY}`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    res.json({
      ip: testIP,
      raw_response: response.data,
      formatted_result: response.data && response.data.city ? {
        city: response.data.city,
        region: response.data.regionName || response.data.region,
        country: response.data.countryName,
        latitude: response.data.latitude,
        longitude: response.data.longitude,
        isp: response.data.isp,
        timezone: response.data.timeZone
      } : null,
      api_source: 'apiip.net'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      ip: testIP,
      api_source: 'apiip.net'
    });
  }
});

// API test loại IP hiện tại
app.get('/api/check-my-ip', (req, res) => {
  // Logic giống như trong processTracking để lấy IP thật
  let clientIP = null;
  let ipType = 'unknown';
  
  const ipHeaders = [
    'cf-connecting-ip',
    'x-real-ip',
    'x-forwarded-for',
    'x-client-ip',
    'x-forwarded',
    'x-cluster-client-ip',
    'forwarded-for',
    'forwarded'
  ];
  
  let allPossibleIPs = [];
  
  for (const header of ipHeaders) {
    if (req.headers[header]) {
      const ips = req.headers[header].split(',').map(ip => ip.trim());
      allPossibleIPs.push(...ips);
    }
  }
  
  const connectionIP = req.connection.remoteAddress || 
                       req.socket.remoteAddress ||
                       (req.connection.socket ? req.connection.socket.remoteAddress : null);
  if (connectionIP) {
    allPossibleIPs.push(connectionIP);
  }
  
  allPossibleIPs = [...new Set(allPossibleIPs)];
  
  const isValidIPv6 = (ip) => {
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(ip) && !ip.startsWith('::ffff:');
  };
  
  const isValidIPv4 = (ip) => {
    const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    return ipv4Regex.test(ip);
  };
  
  const isPrivateIP = (ip) => {
    if (ip === '::1' || ip === '127.0.0.1') return true;
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return true;
    if (ip.startsWith('fc00:') || ip.startsWith('fd00:') || ip.startsWith('fe80:')) return true;
    return false;
  };
  
  let ipv6Candidates = [];
  let ipv4Candidates = [];
  
  for (let ip of allPossibleIPs) {
    if (ip.startsWith('::ffff:')) {
      const ipv4 = ip.substr(7);
      if (isValidIPv4(ipv4) && !isPrivateIP(ipv4)) {
        ipv4Candidates.push(ipv4);
      }
    } else if (isValidIPv6(ip) && !isPrivateIP(ip)) {
      ipv6Candidates.push(ip);
    } else if (isValidIPv4(ip) && !isPrivateIP(ip)) {
      ipv4Candidates.push(ip);
    }
  }
  
  if (ipv6Candidates.length > 0) {
    clientIP = ipv6Candidates[0];
    ipType = 'IPv6';
  } else if (ipv4Candidates.length > 0) {
    clientIP = ipv4Candidates[0];
    ipType = 'IPv4';
  } else {
    clientIP = allPossibleIPs[0];
    if (clientIP && clientIP.startsWith('::ffff:')) {
      clientIP = clientIP.substr(7);
    }
    ipType = isPrivateIP(clientIP) ? 'Private' : 'Fallback';
  }
  
  res.json({
    detectedIP: clientIP,
    ipType: ipType,
    allPossibleIPs: allPossibleIPs,
    ipv6Available: ipv6Candidates,
    ipv4Available: ipv4Candidates,
    headers: {
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
      'x-real-ip': req.headers['x-real-ip'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-client-ip': req.headers['x-client-ip']
    }
  });
});

migrateDatabase();

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
