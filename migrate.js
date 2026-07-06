/**
 * 数据迁移脚本：将旧的 db.json 迁移到 SQLite
 * 用法：node migrate.js
 */
const fs = require('fs');
const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[FATAL] better-sqlite3 not installed. Run: npm install better-sqlite3');
  process.exit(1);
}

const DATA_DIR = process.env.MOMENT_DATA_DIR || '/opt/moment/data';
const DB_PATH = path.join(DATA_DIR, 'moment.db');
const JSON_PATH = path.join(DATA_DIR, 'db.json');

// Check if old db.json exists
if (!fs.existsSync(JSON_PATH)) {
  console.log('[MIGRATE] No db.json found at', JSON_PATH);
  console.log('[MIGRATE] Nothing to migrate. Starting fresh.');
  process.exit(0);
}

console.log('[MIGRATE] Found db.json, reading...');
let oldData;
try {
  oldData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
} catch (e) {
  console.error('[MIGRATE] Failed to parse db.json:', e.message);
  process.exit(1);
}

if (!oldData.users || !oldData.moments) {
  console.log('[MIGRATE] db.json has no users or moments data. Nothing to migrate.');
  process.exit(0);
}

console.log('[MIGRATE] Opening SQLite database...');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables (same as server.js)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    token TEXT DEFAULT '',
    token_created_at INTEGER DEFAULT 0,
    nickname TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    consecutive_days INTEGER DEFAULT 0,
    last_upload_date TEXT DEFAULT '',
    preferences TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS moments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_path TEXT DEFAULT '',
    data_url TEXT DEFAULT '',
    thought TEXT DEFAULT '',
    status TEXT DEFAULT 'approved',
    rejected_message TEXT DEFAULT '',
    like_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    moment_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, moment_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reason TEXT DEFAULT '其他',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(moment_id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE
  );
`);

// Migrate users
const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (id, phone, token, token_created_at, nickname, avatar, consecutive_days, last_upload_date, preferences, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

let userCount = 0;
for (const u of oldData.users) {
  try {
    insertUser.run(
      u.id || userCount + 1,
      u.phone || 'unknown_' + (u.id || userCount + 1),
      u.token || '',
      u.token_created_at || 0,
      u.nickname || '',
      u.avatar || '',
      u.consecutive_days || 0,
      u.last_upload_date || '',
      u.preferences || '{}',
      u.created_at || new Date().toISOString()
    );
    userCount++;
  } catch (e) {
    console.error('[MIGRATE] Failed to migrate user', u.id, ':', e.message);
  }
}
console.log('[MIGRATE] Migrated', userCount, 'users');

// Migrate moments
const insertMoment = db.prepare(
  'INSERT OR IGNORE INTO moments (id, user_id, image_path, data_url, thought, status, rejected_message, like_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

let momentCount = 0;
for (const m of oldData.moments) {
  try {
    insertMoment.run(
      m.id || momentCount + 1,
      m.userId || m.user_id || 1,
      m.imagePath || m.image_path || '',
      m.dataUrl || m.data_url || '',
      m.thought || '',
      m.status || 'approved',
      m.rejectedMessage || m.rejected_message || '',
      m.likeCount || m.like_count || 0,
      m.createdAt || m.created_at || new Date().toISOString()
    );
    momentCount++;
  } catch (e) {
    console.error('[MIGRATE] Failed to migrate moment', m.id, ':', e.message);
  }
}
console.log('[MIGRATE] Migrated', momentCount, 'moments');

// Migrate likes
const insertLike = db.prepare(
  'INSERT OR IGNORE INTO likes (user_id, moment_id, created_at) VALUES (?, ?, ?)'
);

let likeCount = 0;
if (oldData.likes) {
  for (const l of oldData.likes) {
    try {
      insertLike.run(
        l.userId || l.user_id || 1,
        l.momentId || l.moment_id || 1,
        l.createdAt || l.created_at || new Date().toISOString()
      );
      likeCount++;
    } catch (e) {
      // skip duplicates
    }
  }
}
console.log('[MIGRATE] Migrated', likeCount, 'likes');

// Migrate reports
const insertReport = db.prepare(
  'INSERT OR IGNORE INTO reports (moment_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)'
);

let reportCount = 0;
if (oldData.reports) {
  for (const r of oldData.reports) {
    try {
      insertReport.run(
        r.momentId || r.moment_id || 1,
        r.userId || r.user_id || 1,
        r.reason || '其他',
        r.createdAt || r.created_at || new Date().toISOString()
      );
      reportCount++;
    } catch (e) {
      // skip duplicates
    }
  }
}
console.log('[MIGRATE] Migrated', reportCount, 'reports');

// Update nextId sequence
const maxId = db.prepare('SELECT MAX(id) as maxId FROM moments').get().maxId || 0;
console.log('[MIGRATE] Max moment ID:', maxId);

// Backup old db.json
const backupPath = JSON_PATH + '.backup.' + Date.now();
fs.renameSync(JSON_PATH, backupPath);
console.log('[MIGRATE] Backed up old db.json to', backupPath);

console.log('[MIGRATE] Migration complete!');
console.log('[MIGRATE] Summary:');
console.log('  Users:   ' + userCount);
console.log('  Moments: ' + momentCount);
console.log('  Likes:   ' + likeCount);
console.log('  Reports: ' + reportCount);

db.close();
