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

// Database IP range Việt Nam (một số range phổ biến)
const vietnamIPRanges = {
  'viettel': {
    ranges: ['118.69.0.0/16', '171.244.0.0/16', '113.160.0.0/16', '14.160.0.0/16'],
    locations: {
      'gia_lai': {
        ips: ['118.69.31.0/24', '118.69.32.0/24'],
        city: 'Pleiku',
        region: 'Gia Lai',
        latitude: 13.9833,
        longitude: 108.0
      },
      'ha_noi': {
        ips: ['113.160.0.0/16'],
        city: 'Hanoi',
        region: 'Ha Noi',
        latitude: 21.0285,
        longitude: 105.8542
      }
    }
  },
  'fpt': {
    ranges: ['171.244.0.0/16', '125.212.0.0/16'],
    locations: {
      'ho_chi_minh': {
        ips: ['171.244.0.0/16'],
        city: 'Ho Chi Minh City',
        region: 'Ho Chi Minh',
        latitude: 10.8231,
        longitude: 106.6297
      }
    }
  }
};

// Hàm kiểm tra IP có thuộc range Vietnam không
function checkVietnameseIP(ip) {
  // Kiểm tra IP Gia Lai cụ thể
  if (ip.startsWith('118.69.31.') || ip.startsWith('118.69.32.')) {
    return {
      city: 'Pleiku',
      region: 'Gia Lai',
      country_name: 'Vietnam',
      country_code: 'VN',
      latitude: 13.9833,
      longitude: 108.0,
      timezone: 'Asia/Ho_Chi_Minh',
      isp: 'Viettel',
      isVietnamOverride: true
    };
  }
  
  // Thêm các IP range khác của Việt Nam
  if (ip.startsWith('171.244.')) {
    return {
      city: 'Ho Chi Minh City',
      region: 'Ho Chi Minh',
      country_name: 'Vietnam',
      country_code: 'VN',
      latitude: 10.8231,
      longitude: 106.6297,
      timezone: 'Asia/Ho_Chi_Minh',
      isp: 'FPT Telecom',
      isVietnamOverride: true
    };
  }
  
  return null;
}

// Hàm lấy thông tin IP với nhiều nguồn và kiểm tra database Việt Nam
async function getIPInfo(ip) {
  // Ưu tiên kiểm tra database IP Việt Nam trước
  const vietnamInfo = checkVietnameseIP(ip);
  if (vietnamInfo) {
    console.log(`🇻🇳 Using Vietnam IP database for ${ip}`);
    return vietnamInfo;
  }
  
  // Danh sách các API để thử (theo độ ưu tiên)
  const apis = [
    {
      name: 'ip-api.com',
      url: `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`,
      transform: (data) => data && data.status === 'success' ? {
        latitude: data.lat,
        longitude: data.lon,
        country_name: data.country,
        country_code: data.countryCode,
        city: data.city,
        region: data.regionName,
        timezone: data.timezone,
        zip: data.zip,
        isp: data.isp,
        org: data.org,
        api_source: 'ip-api.com'
      } : null
    },
    {
      name: 'ipapi.co',
      url: `https://ipapi.co/${ip}/json/`,
      transform: (data) => data && !data.error ? {
        ...data,
        api_source: 'ipapi.co'
      } : null
    },
    {
      name: 'ipinfo.io',
      url: `https://ipinfo.io/${ip}/json`,
      transform: (data) => data && !data.error ? {
        latitude: data.loc ? parseFloat(data.loc.split(',')[0]) : null,
        longitude: data.loc ? parseFloat(data.loc.split(',')[1]) : null,
        country_name: data.country,
        city: data.city,
        region: data.region,
        timezone: data.timezone,
        org: data.org,
        api_source: 'ipinfo.io'
      } : null
    }
  ];

  // Thử từng API
  for (const api of apis) {
    try {
      const response = await axios.get(api.url, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const result = api.transform(response.data);
      if (result && result.latitude && result.longitude) {
        // Nếu là IP Việt Nam nhưng API trả về sai, override lại
        if (ip.startsWith('118.69.') && result.city && result.city.toLowerCase().includes('ho chi minh')) {
          console.log(`🔧 Correcting location for Vietnamese IP ${ip}: ${result.city} → Pleiku, Gia Lai`);
          return {
            ...result,
            city: 'Pleiku',
            region: 'Gia Lai',
            latitude: 13.9833,
            longitude: 108.0,
            corrected: true,
            original_location: `${result.city}, ${result.region}`
          };
        }
        
        console.log(`✅ Got location from ${api.name}: ${result.city}, ${result.region || result.country_name}`);
        return result;
      }
    } catch (error) {
      console.log(`❌ ${api.name} failed: ${error.message}`);
      continue;
    }
  }
  console.log('❌ All IP location APIs failed');
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
    // Cải thiện cách lấy IP thật của user
    let clientIP = null;
    
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
    
    // Tìm IP từ headers
    for (const header of ipHeaders) {
      if (req.headers[header]) {
        clientIP = req.headers[header];
        break;
      }
    }
    
    // Fallback về connection IP
    if (!clientIP) {
      clientIP = req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);
    }
    
    // Xử lý trường hợp có nhiều IP trong x-forwarded-for (lấy IP đầu tiên - IP gốc)
    if (clientIP && clientIP.includes(',')) {
      clientIP = clientIP.split(',')[0].trim();
    }
    
    // Loại bỏ IPv6 prefix nếu có
    if (clientIP && clientIP.substr(0, 7) === '::ffff:') {
      clientIP = clientIP.substr(7);
    }
    
    // Loại bỏ port nếu có
    if (clientIP && clientIP.includes(':') && !clientIP.includes('::')) {
      clientIP = clientIP.split(':')[0];
    }
    
    const userAgent = req.headers['user-agent'];
    
    // Lấy thông tin vị trí từ IP với độ chính xác cao hơn
    let ipInfo;
    if (clientIP === '::1' || clientIP === '127.0.0.1' || clientIP.startsWith('192.168.') || clientIP.startsWith('10.') || clientIP.startsWith('172.')) {
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

migrateDatabase();

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
