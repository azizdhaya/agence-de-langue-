const express = require('express');
const db = require('../models/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get grades for a student
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  const { get, all } = require('../utils/dbHelpers');
  const { StudentLanguageService } = require('../services/StudentLanguageService');

  // User-first resolution like POST /grades: UI ids are users-table ids.
  let resolvedId;
  try {
    resolvedId = await StudentLanguageService.resolveStudentId(req.params.studentId);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }

  // NOTE: same as attendance — the ownership check must finish first, otherwise
  // a late 403 crashes with ERR_HTTP_HEADERS_SENT after data was already sent.
  if (req.user.role === 'student') {
    const me = await get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!me || me.id !== resolvedId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  try {
    const grades = await all(`
      SELECT g.*, c.name as course_name
      FROM grades g
      JOIN courses c ON g.course_id = c.id
      WHERE g.student_id = ?
      ORDER BY g.date DESC
    `, [resolvedId]);
    res.json(grades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get grades for a course
router.get('/course/:courseId', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res) => {
  const courseId = req.params.courseId;

  db.all(`
    SELECT g.*, u.first_name || ' ' || u.last_name as student_name
    FROM grades g
    JOIN students s ON g.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE g.course_id = ?
    ORDER BY g.date DESC
  `, [courseId], (err, grades) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(grades);
  });
});

// Add grade
router.post('/', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
  const { studentId, courseId, assessmentType, score, maxScore, notes } = req.body;

  if (!studentId || !courseId || !assessmentType || score === undefined) {
    return res.status(400).json({ error: 'Student ID, course ID, assessment type, and score are required' });
  }

  // The UI carries user ids (course member lists select u.id); grades
  // reference the students-table id. Resolve user-first so a user id can
  // never leak into the foreign key (raw SQLITE_CONSTRAINT).
  const { StudentLanguageService } = require('../services/StudentLanguageService');
  let resolvedId;
  try {
    resolvedId = await StudentLanguageService.resolveStudentId(studentId);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }

  db.run(
    `INSERT INTO grades (student_id, course_id, assessment_type, score, max_score, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [resolvedId, courseId, assessmentType, score, maxScore || 100, notes],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: 'Grade added successfully', gradeId: this.lastID });
    }
  );
});

// Update grade
router.put('/:id', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res) => {
  const gradeId = req.params.id;
  const { assessmentType, score, maxScore, notes } = req.body;

  db.run(
    'UPDATE grades SET assessment_type = ?, score = ?, max_score = ?, notes = ? WHERE id = ?',
    [assessmentType, score, maxScore, notes, gradeId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Grade not found' });
      }
      res.json({ message: 'Grade updated successfully' });
    }
  );
});

// Delete grade
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res) => {
  const gradeId = req.params.id;

  db.run('DELETE FROM grades WHERE id = ?', [gradeId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Grade not found' });
    }
    res.json({ message: 'Grade deleted successfully' });
  });
});

// Get grade summary for student
router.get('/summary/:studentId', authenticateToken, async (req, res) => {
  const { get, all } = require('../utils/dbHelpers');
  const { StudentLanguageService } = require('../services/StudentLanguageService');

  let resolvedId;
  try {
    resolvedId = await StudentLanguageService.resolveStudentId(req.params.studentId);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }

  // Same ownership-then-query ordering as above (see /student/:studentId).
  if (req.user.role === 'student') {
    const me = await get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!me || me.id !== resolvedId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  try {
    const summary = await all(`
      SELECT
        c.name as course_name,
        COUNT(*) as total_assessments,
        ROUND(AVG(g.score * 100.0 / g.max_score), 2) as average_percentage,
        ROUND(MAX(g.score * 100.0 / g.max_score), 2) as highest_score,
        ROUND(MIN(g.score * 100.0 / g.max_score), 2) as lowest_score
      FROM grades g
      JOIN courses c ON g.course_id = c.id
      WHERE g.student_id = ?
      GROUP BY g.course_id
    `, [resolvedId]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
