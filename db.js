/** 此刻 Moment - 数据库初始化与工具函数 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Optional: sharp for thumbnail generation. If not installed, uploads still work.
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('[WARN] sharp not installed — thumbnails disabled. Run: npm install sharp');
}

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[FATAL] better-sqlite3 not installed. Run: npm install better-sqlite3');
  process.exit(1);
}

const DATA_DIR = process.env.MOMENT_DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = DATA_DIR + '/uploads';

// Ensure directories exist
[UPLOADS_DIR].forEach(d => {
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
});

// ======================== SQLite Schema & Init ========================
const db = new Database(path.join(DATA_DIR, 'moment.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Additional performance index on created_at (not in original schema)
db.exec(`CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC)`);

// Create tables
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

  CREATE INDEX IF NOT EXISTS idx_moments_user_id ON moments(user_id);
  CREATE INDEX IF NOT EXISTS idx_moments_status ON moments(status);
  CREATE INDEX IF NOT EXISTS idx_likes_moment_id ON likes(moment_id);
  CREATE INDEX IF NOT EXISTS idx_reports_moment_id ON reports(moment_id);
`);

// ======================== Helpers ========================
function uid() { return crypto.randomBytes(16).toString('hex'); }
function mask(p) { return p ? p.slice(0, 3) + '****' + p.slice(-3) : '未知'; }
function imgUrl(p) {
  if (!p) return '';
  if (p.startsWith('http') || p.startsWith('data:')) return p;
  return '/api/image' + p;
}

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// ======================== Image Storage ========================
const THUMB_WIDTH = 400;
const THUMB_QUALITY = 70;

/** Convert original image path to thumbnail path: /uploads/abc.jpg → /uploads/thumb_abc.jpg
 *  Returns null if the thumbnail file does not exist on disk. */
function thumbPath(imagePath) {
  if (!imagePath || !imagePath.startsWith('/uploads/')) return null;
  const base = path.basename(imagePath);
  const tp = '/uploads/thumb_' + base.replace(/\.[^.]+$/, '.jpg');
  // Only return path if thumbnail file actually exists
  if (!fs.existsSync(path.join(UPLOADS_DIR, path.basename(tp)))) return null;
  return tp;
}

function saveImage(dataUrl) {
  if (!dataUrl || !dataUrl.includes('base64,')) return null;
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;
  const ext = matches[1] === 'png' ? 'png' : 'jpg';
  try {
    const buf = Buffer.from(matches[2], 'base64');
    if (buf.length < 4) return null;
    if (ext === 'jpg' && (buf[0] !== 0xFF || buf[1] !== 0xD8)) { console.error('[ERROR] Invalid JPEG magic bytes'); return null; }
    if (ext === 'png' && (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47)) { console.error('[ERROR] Invalid PNG magic bytes'); return null; }
    if (buf.length > 20 * 1024 * 1024) { console.error('[ERROR] Image too large:', buf.length); return null; }
    const name = uid() + '.' + ext;
    const filePath = UPLOADS_DIR + '/' + name;
    fs.writeFileSync(filePath, buf);

    // Generate thumbnail (non-blocking, best-effort)
    if (sharp) {
      const thumbFile = UPLOADS_DIR + '/thumb_' + name.replace(/\.[^.]+$/, '.jpg');
      sharp(buf)
        .resize(THUMB_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: THUMB_QUALITY })
        .toFile(thumbFile)
        .then(() => { /* thumbnail created */ })
        .catch(e => console.error('[ERROR] Thumbnail generation failed:', e.message));
    }

    return '/uploads/' + name;
  } catch (e) { console.error('[ERROR] saveImage failed:', e.message); return null; }
}

// ======================== SMS (Dev Mode) ========================
const SMS_CODES = {};

// Periodic cleanup of expired SMS codes
setInterval(() => {
  const now = Date.now();
  for (const ph of Object.keys(SMS_CODES)) {
    if (SMS_CODES[ph].expiresAt < now) delete SMS_CODES[ph];
  }
}, 5 * 60 * 1000);

function genSMSCode(phone) {
  const now = Date.now();
  for (const ph of Object.keys(SMS_CODES)) {
    if (SMS_CODES[ph].expiresAt < now - 600000) delete SMS_CODES[ph];
  }
  const code = String(crypto.randomInt(100000, 999999));
  SMS_CODES[phone] = { code, expiresAt: now + 5 * 60 * 1000 };
  console.log('[DEV] SMS code for ' + mask(phone) + ': ' + code);
  return code;
}

// ======================== WAL Checkpoint & Backup ========================
const BACKUP_DIR = DATA_DIR + '/backups';
const BACKUP_KEEP_DAYS = 7;

// Ensure backup directory exists
try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) {}

// Passive checkpoint every 5 minutes — merges WAL without blocking writers
setInterval(() => {
  try { db.pragma('wal_checkpoint(PASSIVE)'); } catch (e) {}
}, 5 * 60 * 1000);

// Full TRUNCATE checkpoint at 4:00 AM — resets WAL file to near-zero size
function scheduleTruncateCheckpoint() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(4, 0, 0, 0);
  if (now > target) target.setDate(target.getDate() + 1);
  const msUntil = target.getTime() - now.getTime();

  setTimeout(() => {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      // Daily backup right after truncate checkpoint
      backupDB();
    } catch (e) {
      console.error('[ERROR] Checkpoint/backup failed:', e.message);
    }
    // Schedule next run
    scheduleTruncateCheckpoint();
  }, msUntil);
}

function backupDB() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const dest = path.join(BACKUP_DIR, 'moment-' + dateStr + '.db');

  try {
    // Use SQLite backup API for consistent WAL-mode backups
    db.backup(dest);
    console.log('[BACKUP] Database backed up to', dest);

    // Clean old backups (keep last BACKUP_KEEP_DAYS)
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('moment-') && f.endsWith('.db')).sort();
    while (files.length > BACKUP_KEEP_DAYS) {
      const old = path.join(BACKUP_DIR, files.shift());
      try { fs.unlinkSync(old); } catch (e) {}
    }
  } catch (e) {
    console.error('[ERROR] Backup failed:', e.message);
  }
}

scheduleTruncateCheckpoint();

module.exports = { db, uid, mask, imgUrl, saveImage, thumbPath, TOKEN_TTL_MS, genSMSCode, UPLOADS_DIR, SMS_CODES };
