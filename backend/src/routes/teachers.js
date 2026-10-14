const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../models/database');
const { get, run, transaction } = require('../utils/dbHelpers');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

const router = express.Router();

// Get all teachers
router.get('/', authenticateToken, (req, res) => {
  db.all(`
    SELECT u.*, t.id as teacher_id, t.specialization, t.qualifications, t.bio, t.hourly_rate, t.status, t.hire_date
    FROM users u
    JOIN teachers t ON u.id = t.user_id
    WHERE u.role = 'teacher'
    ORDER BY u.created_at DESC
  `, [], (err, teachers) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Never leak password hashes: strip them before responding.
    res.json(teachers.map(({ password, ...safe }) => safe));
  });
});

// Get teacher by ID
router.get('/:id', authenticateToken, (req, res) => {
  const teacherId = req.params.id;

  db.get(`
    SELECT u.*, t.id as teacher_id, t.specialization, t.qualifications, t.bio, t.hourly_rate, t.status, t.hire_date
    FROM users u
    JOIN teachers t ON u.id = t.user_id
    WHERE u.id = ? AND u.role = 'teacher'
  `, [teacherId], (err, teacher) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    const { password, ...safe } = teacher;
    res.json(safe);
  });
});

// Create teacher (account + profile, atomically)
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.teacher.create), async (req, res) => {
  const { firstName, lastName, email, password, phone, specialization, qualifications, bio, hourlyRate } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await transaction(async () => {
      const user = await run(
        'INSERT INTO users (email, password, first_name, last_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, firstName, lastName, 'teacher', phone ?? null]
      );
      await run(
        'INSERT INTO teachers (user_id, specialization, qualifications, bio, hourly_rate) VALUES (?, ?, ?, ?, ?)',
        [user.lastID, specialization ?? null, qualifications ?? null, bio ?? null, hourlyRate ?? 0]
      );
      return user.lastID;
    });
    res.status(201).json({ success: true, data: { id: userId, email, firstName, lastName } });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, error: { message: 'Cet email est déjà utilisé', code: 'EMAIL_EXISTS' } });
    }
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Update teacher
router.put('/:id', authenticateToken, (req, res) => {
  const teacherId = req.params.id;
  const { firstName, lastName, phone, specialization, qualifications, bio, hourlyRate, status } = req.body;

  if (req.user.role === 'teacher' && req.user.id !== parseInt(teacherId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.serialize(() => {
    db.run(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [firstName, lastName, phone, teacherId]
    );

    db.run(
      'UPDATE teachers SET specialization = ?, qualifications = ?, bio = ?, hourly_rate = ?, status = ? WHERE user_id = ?',
      [specialization, qualifications, bio, hourlyRate, status, teacherId]
    );
  });

  res.json({ message: 'Teacher updated successfully' });
});

// Delete teacher. Refused when courses, groups or sessions still reference
// the teacher; otherwise the user row is deleted and the teacher profile
// follows via ON DELETE CASCADE.
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const teacherId = req.params.id;

  try {
    const teacher = await get('SELECT id FROM teachers WHERE user_id = ?', [teacherId]);
    if (!teacher) {
      return res.status(404).json({ success: false, error: { message: 'Teacher not found', code: 'NOT_FOUND' } });
    }
    const [courses, groups, sessions] = await Promise.all([
      get('SELECT COUNT(*) AS c FROM courses WHERE teacher_id = ?', [teacher.id]),
      get('SELECT COUNT(*) AS c FROM groups WHERE teacher_id = ?', [teacher.id]),
      get('SELECT COUNT(*) AS c FROM sessions WHERE teacher_id = ?', [teacher.id])
    ]);
    const used = (courses ? courses.c : 0) + (groups ? groups.c : 0) + (sessions ? sessions.c : 0);
    if (used > 0) {
      return res.status(409).json({
        success: false,
        error: {
          message: `Cannot delete this teacher: ${courses.c} course(s), ${groups.c} group(s) and ${sessions.c} session(s) still reference them.`,
          code: 'TEACHER_IN_USE'
        }
      });
    }
    await run('DELETE FROM users WHERE id = ? AND role = ?', [teacherId, 'teacher']);
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Get teacher courses
router.get('/:id/courses', authenticateToken, (req, res) => {
  const teacherId = req.params.id;

  db.all(`
    SELECT c.*, COUNT(e.student_id) as enrolled_students
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
    WHERE c.teacher_id = (SELECT id FROM teachers WHERE user_id = ?)
    GROUP BY c.id
  `, [teacherId], (err, courses) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(courses);
  });
});

module.exports = router;
