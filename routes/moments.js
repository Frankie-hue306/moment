/**
 * 此刻 Moment - 内容路由 (上传/画廊/探索/点赞/举报/删除)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db, saveImage, imgUrl, mask, UPLOADS_DIR, thumbPath } = require('../db');
const auth = require('../middleware/auth');

// ======================== Moments ========================
router.post('/api/moments', auth, (r, s) => {
  const { dataUrl, thought } = r.body;
  if (!dataUrl) return s.status(400).json({ error: '缺少照片' });

  const imagePath = saveImage(dataUrl);
  if (!imagePath) return s.status(400).json({ error: '图片数据无效或过大，请重试' });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Update consecutive days
  let consecutive = r.user.consecutive_days || 0;
  if (!r.user.last_upload_date) {
    consecutive = 1;
  } else if (r.user.last_upload_date === yesterday) {
    consecutive += 1;
  } else if (r.user.last_upload_date !== today) {
    consecutive = 1;
  }
  db.prepare('UPDATE users SET consecutive_days = ?, last_upload_date = ? WHERE id = ?')
    .run(consecutive, today, r.user.id);

  const info = db.prepare(
    'INSERT INTO moments (user_id, image_path, thought, created_at) VALUES (?, ?, ?, ?)'
  ).run(r.user.id, imagePath || '', (thought || '').slice(0, 20), now.toISOString());

  s.json({
    id: info.lastInsertRowid,
    imageUrl: imgUrl(imagePath || dataUrl)
  });
});

// ======================== Gallery ========================
router.get('/api/gallery', auth, (r, s) => {
  const moments = db.prepare(
    'SELECT id, image_path, data_url, thought, created_at, status, rejected_message, like_count FROM moments WHERE user_id = ? AND status != \'hidden\' ORDER BY created_at DESC LIMIT 100'
  ).all(r.user.id);

  s.json({
    moments: moments.map(m => ({
      id: m.id,
      dataUrl: imgUrl(m.image_path),
      thumbnailUrl: imgUrl(thumbPath(m.image_path)) || imgUrl(m.image_path),
      thought: m.thought || '',
      created_at: m.created_at,
      status: m.status || 'approved',
      rejectedMessage: m.rejected_message || '',
      like_count: m.like_count || 0
    })),
    total: r.user.consecutive_days || 0
  });
});

// ======================== Explore (Public Moments) ========================
router.get('/api/explore', (r, s) => {
  const pg = parseInt(r.query.page) || 1;
  const lim = Math.min(parseInt(r.query.limit) || 15, 50);

  const moments = db.prepare(`
    SELECT m.id, m.image_path, m.data_url, m.thought, m.created_at, m.like_count, m.user_id, u.phone
    FROM moments m
    JOIN users u ON u.id = m.user_id
    WHERE m.status = 'approved'
      AND (json_extract(u.preferences, '$.photo_public') IS NULL OR json_extract(u.preferences, '$.photo_public') != 'false')
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(lim, (pg - 1) * lim);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM moments m
    JOIN users u ON u.id = m.user_id
    WHERE m.status = 'approved'
      AND (json_extract(u.preferences, '$.photo_public') IS NULL OR json_extract(u.preferences, '$.photo_public') != 'false')
  `).get().count;

  s.json({
    moments: moments.map(m => ({
      id: m.id,
      imageUrl: imgUrl(m.image_path || m.data_url),
      thumbnailUrl: imgUrl(thumbPath(m.image_path)) || imgUrl(m.image_path || m.data_url),
      thought: m.thought || '',
      created_at: m.created_at,
      like_count: m.like_count || 0,
      author_phone_masked: mask(m.phone || '')
    })),
    hasMore: (pg * lim) < total,
    total
  });
});

// ======================== Stranger (Random) ========================
router.get('/api/stranger', (r, s) => {
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM moments m
    JOIN users u ON u.id = m.user_id
    WHERE m.status = 'approved'
      AND (json_extract(u.preferences, '$.photo_public') IS NULL OR json_extract(u.preferences, '$.photo_public') != 'false')
  `).get().count;

  if (count === 0) return s.json({ moment: null });

  const offset = Math.floor(Math.random() * count);
  const m = db.prepare(`
    SELECT m.id, m.image_path, m.data_url, m.thought, m.created_at, m.like_count
    FROM moments m
    JOIN users u ON u.id = m.user_id
    WHERE m.status = 'approved'
      AND (json_extract(u.preferences, '$.photo_public') IS NULL OR json_extract(u.preferences, '$.photo_public') != 'false')
    LIMIT 1 OFFSET ?
  `).get(offset);

  if (!m) return s.json({ moment: null });
  s.json({
    imageUrl: imgUrl(m.image_path || m.data_url),
    thought: m.thought || "",
    created_at: m.created_at,
    like_count: m.like_count || 0
  });
});

// ======================== Like ========================
router.post('/api/like', auth, (r, s) => {
  const mid = parseInt(r.body.momentId);
  if (!mid || isNaN(mid)) return s.status(400).json({ error: '缺少momentId' });

  const m = db.prepare('SELECT id, image_path, user_id, like_count FROM moments WHERE id = ?').get(mid);
  if (!m) return s.status(404).json({ error: '不存在' });

  const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND moment_id = ?').get(r.user.id, mid);
  if (existing) {
    const count = db.prepare('SELECT like_count FROM moments WHERE id = ?').get(mid).like_count;
    return s.json({ liked: true, count: count || 0 });
  }

  db.prepare('INSERT INTO likes (user_id, moment_id) VALUES (?, ?)').run(r.user.id, mid);
  db.prepare('UPDATE moments SET like_count = like_count + 1 WHERE id = ?').run(mid);
  const count = db.prepare('SELECT like_count FROM moments WHERE id = ?').get(mid).like_count;

  s.json({ liked: true, count: count || 0 });
});

router.get('/api/like', auth, (r, s) => {
  const mid = parseInt(r.query.momentId);
  const liked = db.prepare('SELECT id FROM likes WHERE user_id = ? AND moment_id = ?').get(r.user.id, mid);
  const m = db.prepare('SELECT like_count FROM moments WHERE id = ?').get(mid);
  s.json({ liked: !!liked, count: m ? m.like_count : 0 });
});

// ======================== Report ========================
router.post('/api/report', auth, (r, s) => {
  const mid = parseInt(r.body.momentId);
  if (!mid || isNaN(mid)) return s.status(400).json({ error: '缺少momentId' });
  const reason = r.body.reason || '其他';

  const existing = db.prepare('SELECT id FROM reports WHERE moment_id = ? AND user_id = ?').get(mid, r.user.id);
  if (existing) return s.status(400).json({ error: '已举报过' });

  db.prepare('INSERT INTO reports (moment_id, user_id, reason) VALUES (?, ?, ?)').run(mid, r.user.id, reason);

  const cnt = db.prepare('SELECT COUNT(*) as count FROM reports WHERE moment_id = ?').get(mid).count;
  if (cnt >= 3) {
    db.prepare("UPDATE moments SET status = 'hidden' WHERE id = ?").run(mid);
  }

  s.json({ message: '举报成功' });
});

// ======================== Delete Moment ========================
router.delete('/api/moment/:id', auth, (r, s) => {
  const mid = parseInt(r.params.id);
  const m = db.prepare('SELECT id, image_path, user_id FROM moments WHERE id = ? AND user_id = ?').get(mid, r.user.id);
  if (!m) return s.status(404).json({ error: '不存在' });

  if (m.image_path && m.image_path.startsWith('/uploads/')) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(m.image_path))); } catch (e) {}
    // Also delete thumbnail if exists
    const tp = thumbPath(m.image_path);
    if (tp) { try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(tp))); } catch (e) {} }
  }

  db.prepare('DELETE FROM moments WHERE id = ?').run(mid);
  db.prepare('DELETE FROM likes WHERE moment_id = ?').run(mid);
  db.prepare('DELETE FROM reports WHERE moment_id = ?').run(mid);

  s.json({ message: '已删除' });
});

module.exports = router;
