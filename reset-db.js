const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('🗑️  Deleting old database...');

// Xóa database cũ
if (fs.existsSync('tracking.db')) {
  fs.unlinkSync('tracking.db');
  console.log('✅ Old database deleted');
}

// Tạo database mới
const db = new sqlite3.Database('tracking.db');

console.log('🆕 Creating new database with updated schema...');

// Tạo bảng với schema mới
db.serialize(() => {
  db.run(`
    CREATE TABLE tracking_links (
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
    CREATE TABLE visits (
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
});

db.close((err) => {
  if (err) {
    console.error('❌ Error creating database:', err);
  } else {
    console.log('✅ Database reset successfully!');
    console.log('🚀 You can now restart the server');
  }
});
