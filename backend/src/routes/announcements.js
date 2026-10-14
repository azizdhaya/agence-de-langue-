const express = require('express');
const db = require('../models/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all announcements
router.get('/', authenticateToken, (req, res) => {
  const userRole = req.user.role;

  // The admin moderates everything and must see every audience; other roles
  // see 'all' plus their own audience. Both singular ('student') and plural
  // ('students', as stored by the form) spellings match.
  const audienceFilter = userRole === 'admin'
    ? '1 = 1'
    : `(a.target_audience = 'all' OR a.target_audience = ? OR a.target_audience = ?)`;
  const params = userRole === 'admin' ? [] : [userRole, `${userRole}s`];

  db.all(`
    SELECT a.*, u.first_name || ' ' || u.last_name as author_name
    FROM announcements a
    JOIN users u ON a.author_id = u.id
    WHERE ${audienceFilter}
    AND (a.expires_at IS NULL OR date(a.expires_at) >= date('now'))
    ORDER BY a.created_at DESC
  `, params, (err, announcements) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(announcements);
  });
});

// Create announcement
router.post('/', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { title, content, targetAudience, priority, expiresAt } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  // An untouched date input arrives as '': NULL means "never expires", while
  // '' would fail the expires_at > now() filter and hide the announcement.
  const expiry = expiresAt && String(expiresAt).trim() !== '' ? expiresAt : null;

  db.run(
    `INSERT INTO announcements (title, content, author_id, target_audience, priority, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, content, req.user.id, targetAudience || 'all', priority || 'normal', expiry],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: 'Announcement created successfully', announcementId: this.lastID });
    }
  );
});

// Update announcement
router.put('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const announcementId = req.params.id;
  const { title, content, targetAudience, priority, expiresAt } = req.body;

  const expiry = expiresAt && String(expiresAt).trim() !== '' ? expiresAt : null;

  db.run(
    `UPDATE announcements SET title = ?, content = ?, target_audience = ?, priority = ?, expires_at = ?
     WHERE id = ?`,
    [title, content, targetAudience, priority, expiry, announcementId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      res.json({ message: 'Announcement updated successfully' });
    }
  );
});

// Delete announcement
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const announcementId = req.params.id;

  db.run('DELETE FROM announcements WHERE id = ?', [announcementId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ message: 'Announcement deleted successfully' });
  });
});

module.exports = router;
