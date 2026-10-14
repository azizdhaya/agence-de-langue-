const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

const router = express.Router();

// Register. Admin-only: an open endpoint let anyone forge any role,
// including admin. Validated (email shape, password length, role whitelist).
router.post('/register', authenticateToken, authorizeRoles('admin'), validate(schemas.auth.register), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (email, password, first_name, last_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName, role, phone],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: err.message });
        }

        const userId = this.lastID;

        // Create role-specific record
        if (role === 'student') {
          db.run('INSERT INTO students (user_id) VALUES (?)', [userId]);
        } else if (role === 'teacher') {
          db.run('INSERT INTO teachers (user_id) VALUES (?)', [userId]);
        }

        res.status(201).json({
          message: 'User registered successfully',
          userId
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', validate(schemas.auth.login), (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar
      }
    });
  });
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT id, email, first_name, last_name, role, phone, avatar FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

module.exports = router;
