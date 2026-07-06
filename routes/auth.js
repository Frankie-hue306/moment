/**
 * 此刻 Moment - 认证路由 (SMS + 登录)
 */
const express = require('express');
const router = express.Router();
const { db, SMS_CODES, genSMSCode, uid, imgUrl } = require('../db');

// SMS frequency limiting: per-phone and per-IP, 1 request per 60s
const smsRateMap = {}; // key: timestamp of last request
const SMS_COOLDOWN_MS = 60 * 1000;

// Periodic cleanup of expired SMS rate entries (supports both simple timestamps and counter objects)
setInterval(() => {
  const now = Date.now();
  for (const k of Object.keys(smsRateMap)) {
    const entry = smsRateMap[k];
    if (typeof entry === 'object' ? entry.resetAt < now : entry < now - SMS_COOLDOWN_MS * 2) {
      delete smsRateMap[k];
    }
  }
}, 5 * 60 * 1000);

router.post('/api/sms/send', (r, s) => {
  const ph = r.body.phone;
  if (!ph || !/^\d{11}$/.test(ph)) return s.status(400).json({ error: '手机号格式不对' });

  // Per-number rate check
  const now = Date.now();
  const phoneKey = 'ph:' + ph;
  if (smsRateMap[phoneKey] && (now - smsRateMap[phoneKey]) < SMS_COOLDOWN_MS) {
    return s.status(429).json({ error: '验证码请求过于频繁，请稍后再试' });
  }

  // Per-IP rate check (max 3 SMS requests per minute per IP)
  const ip = r.ip || r.connection.remoteAddress || 'unknown';
  const ipKey = 'ip:' + ip;
  const ipEntry = smsRateMap[ipKey];
  if (!ipEntry) {
    smsRateMap[ipKey] = { count: 1, resetAt: now + 60 * 1000 };
  } else if (now > ipEntry.resetAt) {
    smsRateMap[ipKey] = { count: 1, resetAt: now + 60 * 1000 };
  } else {
    ipEntry.count++;
    if (ipEntry.count > 3) {
      return s.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }
  }

  smsRateMap[phoneKey] = now;

  genSMSCode(ph);
  s.json({ message: '验证码已发送（开发模式：查看服务器日志）' });
});

// ======================== Login ========================
router.post('/api/login', (r, s) => {
  const ph = r.body.phone;
  const code = r.body.code;
  if (!ph || !/^\d{11}$/.test(ph)) return s.status(400).json({ error: '手机号格式不对' });
  if (!code) return s.status(400).json({ error: '请输入验证码' });

  const cached = SMS_CODES[ph];
  // SECURITY: Dev login is FORCE-DISABLED in production regardless of env var
  const isProduction = (process.env.NODE_ENV === 'production');
  const isDev = !isProduction && (process.env.MOMENT_DEV_LOGIN === '1');
  if (isDev && code.length === 6 && code !== '000000') {
    if (!cached) { genSMSCode(ph); }
  } else {
    if (!cached) return s.status(400).json({ error: '请先获取验证码' });
    if (Date.now() > cached.expiresAt) return s.status(400).json({ error: '验证码已过期，请重新获取' });
    if (cached.code !== code) return s.status(400).json({ error: '验证码错误' });
  }
  delete SMS_CODES[ph];

  let u = db.prepare('SELECT * FROM users WHERE phone = ?').get(ph);
  const token = 'tok_' + uid();
  const now = Date.now();

  if (!u) {
    const info = db.prepare(
      'INSERT INTO users (phone, token, token_created_at, preferences) VALUES (?, ?, ?, ?)'
    ).run(ph, token, now, JSON.stringify({ daily_pick_enabled: true }));
    u = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  } else {
    db.prepare('UPDATE users SET token = ?, token_created_at = ? WHERE id = ?')
      .run(token, now, u.id);
    u.token = token;
    u.token_created_at = now;
  }

  let prefs = {};
  try { prefs = JSON.parse(u.preferences || '{}'); } catch (e) {}

  s.json({
    token: u.token,
    tokenCreatedAt: u.token_created_at,
    userId: u.id,
    nickname: u.nickname || '',
    avatar: imgUrl(u.avatar),
    preferences: prefs
  });
});

module.exports = router;
