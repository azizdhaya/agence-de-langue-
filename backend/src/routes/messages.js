const express = require('express');
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

const router = express.Router();

// Get conversations for a user
router.get('/conversations', authenticateToken, (req, res) => {
  const userId = req.user.id;
  // NOTE: the contact expression is repeated verbatim in the subqueries
  // because SQLite cannot reference the SELECT alias there.
  const contact = 'CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END';

  db.all(`
    SELECT DISTINCT
      ${contact} as contact_id,
      u.first_name || ' ' || u.last_name as contact_name,
      u.role as contact_role,
      (SELECT content FROM messages WHERE (sender_id = ? AND receiver_id = (${contact})) OR (sender_id = (${contact}) AND receiver_id = ?) ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE (sender_id = ? AND receiver_id = (${contact})) OR (sender_id = (${contact}) AND receiver_id = ?) ORDER BY created_at DESC LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM messages WHERE sender_id = (${contact}) AND receiver_id = ? AND is_read = 0) as unread_count
    FROM messages m
    JOIN users u ON u.id = (${contact})
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY last_message_time DESC
  `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId], (err, conversations) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(conversations);
  });
});

// Get messages between two users
router.get('/:contactId', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const contactId = req.params.contactId;

  db.all(`
    SELECT m.*, u.first_name || ' ' || u.last_name as sender_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `, [userId, contactId, contactId, userId], (err, messages) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Mark messages as read
    db.run(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [contactId, userId]
    );

    res.json(messages);
  });
});

// Send message
router.post('/', authenticateToken, validate(schemas.message.create), (req, res) => {
  const { receiverId, content } = req.body;
  const senderId = req.user.id;

  // Unknown receivers failed with a raw SQLITE_CONSTRAINT on the FK.
  db.get('SELECT id FROM users WHERE id = ?', [receiverId], (lookupErr, receiver) => {
    if (lookupErr) {
      return res.status(500).json({ error: lookupErr.message });
    }
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    db.run(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [senderId, receiverId, content],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
          message: 'Message sent successfully',
          messageId: this.lastID
        });
      }
    );
  });
});

// Get all users for messaging (contacts)
router.get('/contacts/all', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  let query = '';
  let params = [];

  if (userRole === 'student') {
    // Students can message teachers and admins
    query = `SELECT id, first_name || ' ' || last_name as name, role, email FROM users WHERE role IN ('teacher', 'admin') AND id != ?`;
    params = [userId];
  } else if (userRole === 'teacher') {
    // Teachers can message students and admins
    query = `SELECT id, first_name || ' ' || last_name as name, role, email FROM users WHERE role IN ('student', 'admin') AND id != ?`;
    params = [userId];
  } else {
    // Admins can message everyone
    query = `SELECT id, first_name || ' ' || last_name as name, role, email FROM users WHERE id != ?`;
    params = [userId];
  }

  db.all(query, params, (err, contacts) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(contacts);
  });
});

module.exports = router;
