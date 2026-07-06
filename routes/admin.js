/**
 * 此刻 Moment - 管理员路由
 */
const express = require('express');
const router = express.Router();
const { db, imgUrl } = require('../db');
const auth = require('../middleware/auth');

// Admin user ID — override via env var. Default: user 1 (first registered user)
const ADMIN_USER_ID = parseInt(process.env.MOMENT_ADMIN_USER_ID) || 1;

// Admin confirmation token — override via env var in production
const ADMIN_CLEAR_TOKEN = process.env.MOMENT_ADMIN_CLEAR_TOKEN || 'CONFIRM_CLEAR_ALL_DATA';

// Helper: check if the authenticated user is an admin
function isAdmin(user) { return user.id === ADMIN_USER_ID; }

// ======================== Admin (SECURE) ========================
router.post('/api/admin/clear', auth, (r, s) => {
  if (!isAdmin(r.user)) return s.status(403).json({ error: '无权限' });

  const confirmToken = r.body.confirm_token;
  if (!confirmToken || confirmToken !== ADMIN_CLEAR_TOKEN) {
    return s.status(400).json({ error: '请提供确认令牌。此操作不可恢复！' });
  }

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('DELETE FROM reports').run();
    db.prepare('DELETE FROM likes').run();
    db.prepare('DELETE FROM moments').run();
    db.exec('COMMIT');
    s.json({ message: '已清空所有内容数据' });
  } catch (e) {
    db.exec('ROLLBACK');
    s.status(500).json({ error: '清空失败' });
  }
});

// ======================== Admin Review ========================

// List reported/pending moments for review
router.get('/api/admin/moments', auth, (r, s) => {
  if (!isAdmin(r.user)) return s.status(403).json({ error: '无权限' });

  const page = parseInt(r.query.page) || 1;
  const limit = Math.min(parseInt(r.query.limit) || 20, 50);

  // Moments with reports that still need review (status != 'hidden' means not auto-hidden yet)
  // Also include pending-status moments
  const moments = db.prepare(`
    SELECT m.id, m.image_path, m.thought, m.status, m.created_at,
           u.phone, u.nickname,
           COUNT(rpt.id) as report_count
    FROM moments m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN reports rpt ON rpt.moment_id = m.id
    WHERE m.status IN ('approved', 'pending')
    GROUP BY m.id
    HAVING report_count > 0 OR m.status = 'pending'
    ORDER BY report_count DESC, m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, (page - 1) * limit);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT m.id, COUNT(rpt.id) as rc
      FROM moments m
      LEFT JOIN reports rpt ON rpt.moment_id = m.id
      WHERE m.status IN ('approved', 'pending')
      GROUP BY m.id
      HAVING rc > 0 OR m.status = 'pending'
    )
  `).get().count;

  s.json({
    moments: moments.map(m => ({
      id: m.id,
      imageUrl: imgUrl(m.image_path),
      thought: m.thought || '',
      status: m.status,
      created_at: m.created_at,
      author: m.nickname || (m.phone ? m.phone.slice(0, 3) + '****' + m.phone.slice(-3) : '未知'),
      reportCount: m.report_count
    })),
    hasMore: (page * limit) < total,
    total
  });
});

// Approve a moment (clear reports, set status to approved)
router.post('/api/admin/moments/:id/approve', auth, (r, s) => {
  if (!isAdmin(r.user)) return s.status(403).json({ error: '无权限' });

  const mid = parseInt(r.params.id);
  const m = db.prepare('SELECT * FROM moments WHERE id = ?').get(mid);
  if (!m) return s.status(404).json({ error: '不存在' });

  db.prepare("UPDATE moments SET status = 'approved' WHERE id = ?").run(mid);
  db.prepare('DELETE FROM reports WHERE moment_id = ?').run(mid);
  s.json({ message: '已通过审核' });
});

// Reject a moment (set status to rejected, clear reports)
router.post('/api/admin/moments/:id/reject', auth, (r, s) => {
  if (!isAdmin(r.user)) return s.status(403).json({ error: '无权限' });

  const mid = parseInt(r.params.id);
  const m = db.prepare('SELECT * FROM moments WHERE id = ?').get(mid);
  if (!m) return s.status(404).json({ error: '不存在' });

  const reason = (r.body.reason || '内容不符合社区规范').slice(0, 200);
  db.prepare("UPDATE moments SET status = 'rejected', rejected_message = ? WHERE id = ?").run(reason, mid);
  db.prepare('DELETE FROM reports WHERE moment_id = ?').run(mid);
  s.json({ message: '已驳回' });
});

module.exports = router;
