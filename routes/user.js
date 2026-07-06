/**
 * 此刻 Moment - 用户路由 (统计/偏好/昵称/头像/注销)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db, imgUrl, saveImage, thumbPath, UPLOADS_DIR } = require('../db');
const auth = require('../middleware/auth');

// ======================== Stats ========================
router.get('/api/stats', auth, (r, s) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM moments WHERE user_id = ?').get(r.user.id).count;
  s.json({ streak: r.user.consecutive_days || 0, total, badges: [] });
});

// ======================== Preferences ========================
router.post('/api/user/preferences', auth, (r, s) => {
  let prefs = {};
  try { prefs = JSON.parse(r.user.preferences || '{}'); } catch (e) {}
  if (r.body.daily_pick_enabled !== undefined) prefs.daily_pick_enabled = !!r.body.daily_pick_enabled;
  if (r.body.photo_public !== undefined) prefs.photo_public = !!r.body.photo_public;
  db.prepare('UPDATE users SET preferences = ? WHERE id = ?').run(JSON.stringify(prefs), r.user.id);
  s.json({ preferences: prefs });
});

router.get('/api/user/preferences', auth, (r, s) => {
  let prefs = {};
  try { prefs = JSON.parse(r.user.preferences || '{}'); } catch (e) {}
  s.json({ preferences: prefs });
});

// ======================== Nickname ========================
router.post('/api/user/nickname', auth, (r, s) => {
  const nick = (r.body.nickname || '').slice(0, 20);
  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nick, r.user.id);
  s.json({ nickname: nick });
});

// ======================== Avatar ========================
router.post('/api/user/avatar', auth, (r, s) => {
  const ap = saveImage(r.body.avatar);
  if (ap) {
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(ap, r.user.id);
    s.json({ avatar: imgUrl(ap) });
  } else {
    const avatar = (r.body.avatar || "").slice(0, 200000);
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, r.user.id);
    s.json({ avatar: imgUrl(avatar) });
  }
});

// ======================== Account Deletion ========================
router.post('/api/account/delete', auth, (r, s) => {
  if (r.user.id === 1) return s.status(400).json({ error: '管理员账号不可注销' });

  const moments = db.prepare('SELECT image_path FROM moments WHERE user_id = ?').all(r.user.id);
  moments.forEach(m => {
    if (m.image_path && m.image_path.startsWith('/uploads/')) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(m.image_path))); } catch (e) {}
      // Also delete thumbnail
      const tp = thumbPath(m.image_path);
      if (tp) { try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(tp))); } catch (e) {} }
    }
  });

  db.prepare('DELETE FROM users WHERE id = ?').run(r.user.id);

  s.json({ message: '账号已注销' });
});

module.exports = router;
