/**
 * 此刻 Moment - 服务器入口
 *
 * 组装中间件、路由并启动 HTTP 服务。
 * 数据库初始化、工具函数：./db.js
 * 路由模块：         ./routes/*.js
 * 中间件：           ./middleware/*.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

const app = express();

// Trust reverse proxy (Nginx) so req.ip returns real client IP
app.set('trust proxy', 1);

// -------------------- 环境检测 --------------------
const isProduction = (process.env.NODE_ENV === 'production');

// -------------------- CORS --------------------
const CORS_ORIGIN = process.env.MOMENT_CORS_ORIGIN || 'https://cikemoment.cn';
app.use(cors({
  origin: function (origin, cb) {
    if (!origin || origin.startsWith('file://')) return cb(null, true);
    if (origin === CORS_ORIGIN) return cb(null, true);
    // Capacitor / Cordova hybrid apps (use custom scheme origins)
    if (/^(capacitor|ionic|https):\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (!isProduction && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (origin === 'https://cikemoment.cn') return cb(null, true);
    cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
}));

// -------------------- 基础中间件 --------------------
app.use(morgan(':method :url :status :response-time ms - :remote-addr'));
app.use(express.json({ limit: '10mb' }));

// -------------------- 静态文件 --------------------
const PUBLIC_DIR = process.env.MOMENT_PUBLIC_DIR || path.join(__dirname, 'public');
const DATA_DIR = process.env.MOMENT_DATA_DIR || path.join(__dirname, 'data');

[PUBLIC_DIR, DATA_DIR].forEach(d => {
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
});

app.use(express.static(PUBLIC_DIR));

// -------------------- 限流中间件 --------------------
const rateLimit = require('./middleware/rateLimit');
app.use('/api', rateLimit);

// -------------------- 路由 --------------------
app.use(require('./routes/auth'));
app.use(require('./routes/moments'));
app.use(require('./routes/user'));
app.use(require('./routes/admin'));
app.use(require('./routes/images'));

// -------------------- Health --------------------
app.get('/health', (r, s) => s.json({ ok: true }));

// -------------------- 404 & 错误处理 --------------------
app.use('/api', (r, s) => {
  s.status(404).json({ error: '接口不存在' });
});

app.use((r, s) => {
  s.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// -------------------- 启动 --------------------
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('Moment Server (SQLite) on port ' + PORT);
  console.log('Data directory: ' + DATA_DIR);
  console.log('Production mode: ' + (isProduction ? 'yes' : 'no'));
  if (process.env.MOMENT_DEV_LOGIN === '1') {
    if (isProduction) {
      console.error('==============================================================');
      console.error('[SECURITY] MOMENT_DEV_LOGIN=1 is set but NODE_ENV=production!');
      console.error('[SECURITY] Dev login has been FORCE-DISABLED by code safeguard.');
      console.error('[SECURITY] SMS verification is still required for all logins.');
      console.error('==============================================================');
    } else {
      console.warn('[WARN] MOMENT_DEV_LOGIN is enabled! Disable before deploying.');
    }
  }
});

// -------------------- Graceful Shutdown --------------------
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    try {
      const { db } = require('./db');
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('Database checkpointed and closed.');
    } catch (e) {
      console.error('Error during DB shutdown:', e.message);
    }
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => { process.exit(1); }, 10000);
}
