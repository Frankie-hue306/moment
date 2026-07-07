/**
 * 此刻 Moment - Token鉴权中间件
 */
const { db, TOKEN_TTL_MS } = require('../db');

function auth(r, s, next) {
  const tok = r.headers['x-auth-token'] || '';
  const u = db.prepare('SELECT id, phone, nickname, avatar, token, token_created_at, consecutive_days, last_upload_date, preferences FROM users WHERE token = ?').get(tok);
  if (!u) return s.status(401).json({ error: '请先登录' });
  if (u.token_created_at && Date.now() - u.token_created_at > TOKEN_TTL_MS) {
    db.prepare("UPDATE users SET token = '' WHERE id = ?").run(u.id);
    return s.status(401).json({ error: '登录已过期，请重新登录' });
  }
  r.user = u;
  next();
}

module.exports = auth;
