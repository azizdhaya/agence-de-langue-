const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../models/database');
const { get, run, transaction } = require('../utils/dbHelpers');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

const router = express.Router();

// Get all students
router.get('/', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res) => {
  db.all(`
    SELECT u.*, s.date_of_birth, s.address, s.level, s.status, s.emergency_contact, s.emergency_phone, s.enrollment_date
    FROM users u
    JOIN students s ON u.id = s.user_id
    WHERE u.role = 'student'
    ORDER BY u.created_at DESC
  `, [], (err, students) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Never leak password hashes: strip them before responding.
    res.json(students.map(({ password, ...safe }) => safe));
  });
});

// Get student by ID
router.get('/:id', authenticateToken, (req, res) => {
  const studentId = req.params.id;

  // Students can only view their own profile
  if (req.user.role === 'student' && req.user.id !== parseInt(studentId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.get(`
    SELECT u.*, s.date_of_birth, s.address, s.level, s.status, s.emergency_contact, s.emergency_phone, s.enrollment_date
    FROM users u
    JOIN students s ON u.id = s.user_id
    WHERE u.id = ? AND u.role = 'student'
  `, [studentId], (err, student) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const { password, ...safe } = student;
    res.json(safe);
  });
});

// Create student (account + profile, atomically)
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.student.create), async (req, res) => {
  const { firstName, lastName, email, password, phone, dateOfBirth, address, emergencyContact, emergencyPhone, level } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await transaction(async () => {
      const user = await run(
        'INSERT INTO users (email, password, first_name, last_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, firstName, lastName, 'student', phone ?? null]
      );
      await run(
        'INSERT INTO students (user_id, date_of_birth, address, emergency_contact, emergency_phone, level) VALUES (?, ?, ?, ?, ?, ?)',
        [user.lastID, dateOfBirth ?? null, address ?? null, emergencyContact ?? null, emergencyPhone ?? null, level ?? 'beginner']
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

// Update student
router.put('/:id', authenticateToken, (req, res) => {
  const studentId = req.params.id;
  const { firstName, lastName, phone, dateOfBirth, address, emergencyContact, emergencyPhone, level, status } = req.body;

  if (req.user.role === 'student' && req.user.id !== parseInt(studentId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.serialize(() => {
    db.run(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [firstName, lastName, phone, studentId]
    );

    db.run(
      'UPDATE students SET date_of_birth = ?, address = ?, emergency_contact = ?, emergency_phone = ?, level = ?, status = ? WHERE user_id = ?',
      [dateOfBirth, address, emergencyContact, emergencyPhone, level, status, studentId]
    );
  });

  res.json({ message: 'Student updated successfully' });
});

// Delete student. Refused with an explicit message when enrolments still
// reference the student, instead of a raw FK 500.
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const studentId = req.params.id;

  try {
    const student = await get(
      'SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.id = ? AND u.role = ?',
      [studentId, 'student']
    );
    if (!student) {
      return res.status(404).json({ success: false, error: { message: 'Student not found', code: 'NOT_FOUND' } });
    }
    const enrolments = await get(
      'SELECT COUNT(*) AS c FROM enrollments WHERE student_id = ?', [student.id]
    );
    if (enrolments && enrolments.c > 0) {
      return res.status(409).json({
        success: false,
        error: {
          message: `Cannot delete this student: ${enrolments.c} enrolment(s) still reference them.`,
          code: 'STUDENT_IN_USE'
        }
      });
    }
    await run('DELETE FROM users WHERE id = ? AND role = ?', [studentId, 'student']);
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Get student courses
router.get('/:id/courses', authenticateToken, (req, res) => {
  const studentId = req.params.id;

  if (req.user.role === 'student' && req.user.id !== parseInt(studentId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.all(`
    SELECT c.*, e.id as enrollment_id, e.enrollment_date, e.status as enrollment_status, u.first_name || ' ' || u.last_name as teacher_name
    FROM courses c
    JOIN enrollments e ON c.id = e.course_id
    LEFT JOIN teachers t ON c.teacher_id = t.id
    LEFT JOIN users u ON t.user_id = u.id
    WHERE e.student_id = (SELECT id FROM students WHERE user_id = ?)
  `, [studentId], (err, courses) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(courses);
  });
});

module.exports = router;
