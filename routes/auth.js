/**
 * 此刻 Moment - 认证路由 (手机号 + 密码)
 */
const express = require('express');
const router = express.Router();
const { db, uid, imgUrl, hashPassword, verifyPassword } = require('../db');

// ======================== Register ========================
router.post('/api/auth/register', (r, s) => {
  const ph = r.body.phone;
  const pw = r.body.password;
  if (!ph || !/^\d{11}$/.test(ph)) return s.status(400).json({ error: '手机号格式不对' });
  if (!pw || pw.length < 6) return s.status(400).json({ error: '密码至少6位' });

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(ph);
  if (existing) return s.status(409).json({ error: '手机号已注册，请直接登录' });

  const passwordHash = hashPassword(pw);
  const token = 'tok_' + uid();
  const now = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10);

  const info = db.prepare(
    'INSERT INTO users (phone, password_hash, token, token_created_at, registered_at) VALUES (?, ?, ?, ?, ?)'
  ).run(ph, passwordHash, token, now, dateStr);

  const u = db.prepare('SELECT id, phone, nickname, avatar, token, token_created_at, preferences FROM users WHERE id = ?').get(info.lastInsertRowid);

  let prefs = {};
  try { prefs = JSON.parse(u.preferences || '{}'); } catch (e) {}

  s.json({
    token: u.token,
    tokenCreatedAt: u.token_created_at,
    userId: u.id,
    nickname: u.nickname || '',
    avatar: imgUrl(u.avatar),
    preferences: prefs,
    isNewUser: true
  });
});

// ======================== Login ========================
router.post('/api/auth/login', (r, s) => {
  const ph = r.body.phone;
  const pw = r.body.password;
  if (!ph || !/^\d{11}$/.test(ph)) return s.status(400).json({ error: '手机号格式不对' });
  if (!pw) return s.status(400).json({ error: '请输入密码' });

  const u = db.prepare('SELECT id, phone, password_hash, nickname, avatar, preferences FROM users WHERE phone = ?').get(ph);
  if (!u) return s.status(401).json({ error: '手机号未注册' });

  // Legacy users: no password set (old SMS-only accounts)
  if (!u.password_hash) {
    return s.status(401).json({ error: '您的账号尚未设置密码，请联系客服' });
  }

  if (!verifyPassword(pw, u.password_hash)) {
    return s.status(401).json({ error: '密码错误' });
  }

  const token = 'tok_' + uid();
  const now = Date.now();
  db.prepare('UPDATE users SET token = ?, token_created_at = ? WHERE id = ?').run(token, now, u.id);

  let prefs = {};
  try { prefs = JSON.parse(u.preferences || '{}'); } catch (e) {}

  s.json({
    token: token,
    tokenCreatedAt: now,
    userId: u.id,
    nickname: u.nickname || '',
    avatar: imgUrl(u.avatar),
    preferences: prefs
  });
});

module.exports = router;
