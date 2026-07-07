/**
 * 此刻 Moment - 图片访问控制路由
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db, UPLOADS_DIR } = require('../db');

// ======================== Image Serving (SECURE) ========================
router.get('/api/image/uploads/:name', (r, s) => {
  const name = r.params.name;

  // SECURITY: Path traversal protection
  if (name !== path.basename(name) || name.includes('/') || name.includes('..') || name.includes('\\')) {
    return s.status(400).json({ error: '非法文件名' });
  }

  const imgPath = '/uploads/' + name;
  const filePath = path.join(UPLOADS_DIR, name);

  if (!fs.existsSync(filePath)) return s.status(404).end();

  // For thumbnails, look up the original image path for ACL
  let lookupPath = imgPath;
  if (name.startsWith('thumb_')) {
    lookupPath = '/uploads/' + name.replace(/^thumb_/, '');
  }

  // SECURITY: Check if this image belongs to a public moment or if the requester is the owner
  const moment = db.prepare(`
    SELECT m.*, u.preferences FROM moments m JOIN users u ON u.id = m.user_id WHERE m.image_path = ?
  `).get(lookupPath);

  if (moment) {
    let prefs = {};
    try { prefs = JSON.parse(moment.preferences || '{}'); } catch (e) {}
    // If not public, check auth
    if (prefs.photo_public === false || moment.status !== 'approved') {
      const tok = r.headers['x-auth-token'] || '';
      const u = db.prepare('SELECT id, token FROM users WHERE token = ?').get(tok);
      if (!u || u.id !== moment.user_id) {
        return s.status(404).end();
      }
    }
  }
  // If moment not found in DB (legacy data), require auth
  else {
    const tok = r.headers['x-auth-token'] || '';
    const u = db.prepare('SELECT id FROM users WHERE token = ?').get(tok);
    if (!u) return s.status(404).end();
  }

  const ext = path.extname(name).toLowerCase();
  const ct = ext === '.png' ? 'image/png' : 'image/jpeg';
  s.set({ 'Content-Type': ct, 'Cache-Control': 'public,max-age=86400' });
  s.sendFile(filePath);
});

// Legacy fallback
router.get('/api/image/:id', (r, s) => {
  const m = db.prepare('SELECT id, image_path, data_url, status, user_id FROM moments WHERE id = ?').get(parseInt(r.params.id));
  if (!m) return s.status(404).end();

  const user = db.prepare('SELECT preferences FROM users WHERE id = ?').get(m.user_id);
  let prefs = {};
  try { prefs = JSON.parse(user?.preferences || '{}'); } catch (e) {}
  if (prefs.photo_public === false || m.status !== 'approved') {
    const tok = r.headers['x-auth-token'] || '';
    const u = db.prepare('SELECT id FROM users WHERE token = ?').get(tok);
    if (!u || u.id !== m.user_id) return s.status(404).end();
  }

  if (m.image_path && m.image_path.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(m.image_path));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(m.image_path).toLowerCase();
      s.set({ 'Content-Type': ext === '.png' ? 'image/png' : 'image/jpeg', 'Cache-Control': 'public,max-age=86400' });
      return s.sendFile(filePath);
    }
  }
  if (m.data_url) {
    const b = Buffer.from(m.data_url.split(',')[1] || '', 'base64');
    s.set({ 'Content-Type': m.data_url.startsWith('data:image/png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'public,max-age=86400' });
    return s.send(b);
  }
  s.status(404).end();
});

module.exports = router;
