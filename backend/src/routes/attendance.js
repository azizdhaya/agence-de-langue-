const express = require('express');
const db = require('../models/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get attendance for a course
router.get('/course/:courseId', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res) => {
  const courseId = req.params.courseId;
  const { date } = req.query;

  let query = `
    SELECT a.*, u.id as user_id, u.first_name || ' ' || u.last_name as student_name
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE a.course_id = ?
  `;
  let params = [courseId];

  if (date) {
    query += ' AND a.date = ?';
    params.push(date);
  }

  query += ' ORDER BY a.date DESC, student_name';

  db.all(query, params, (err, attendance) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(attendance);
  });
});

// Mark attendance
router.post('/', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
  const { studentId, courseId, date, status, notes, sessionId } = req.body;

  if (!studentId || !courseId || !date || !status) {
    return res.status(400).json({ error: 'Student ID, course ID, date, and status are required' });
  }

  // Same user-first convention as grades: the UI carries user ids.
  const { StudentLanguageService } = require('../services/StudentLanguageService');
  const AttendanceService = require('../services/AttendanceService');
  let resolvedId;
  try {
    resolvedId = await StudentLanguageService.resolveStudentId(studentId);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }

  // Hard block: an unpaid submodule (the one the séance teaches) forbids the
  // student from being marked present.
  try {
    await AttendanceService.assertAllowed(sessionId, [resolvedId]);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code });
  }

  db.run(
    `INSERT OR REPLACE INTO attendance (student_id, course_id, session_id, date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [resolvedId, courseId, sessionId || null, date, status, notes],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: 'Attendance recorded successfully' });
    }
  );
});

// Bulk mark attendance
router.post('/bulk', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
  const { courseId, date, attendanceData, sessionId } = req.body;

  if (!courseId || !date || !attendanceData || !Array.isArray(attendanceData)) {
    return res.status(400).json({ error: 'Invalid data provided' });
  }

  // Validate every row BEFORE writing, so a bad row cannot silently pass
  // while the API reports success.
  const invalid = [];
  attendanceData.forEach((record, index) => {
    if (!record || !record.studentId || !record.status) {
      invalid.push(index);
    }
  });
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid attendance rows at indexes: ${invalid.join(', ')}` });
  }

  // Resolve every student id first (user-first): one unknown id aborts the
  // whole batch before anything is written.
  const { StudentLanguageService } = require('../services/StudentLanguageService');
  const AttendanceService = require('../services/AttendanceService');
  const resolved = [];
  for (let index = 0; index < attendanceData.length; index++) {
    try {
      resolved.push(await StudentLanguageService.resolveStudentId(attendanceData[index].studentId));
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: `Row ${index}: ${error.message}`
      });
    }
  }

  // Hard block: refuse the whole batch if any student still owes the séance's
  // submodule, so nothing is half-written.
  try {
    await AttendanceService.assertAllowed(sessionId, resolved);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code });
  }

  // Sequential awaits (not fire-and-forget stmt.run): a write failure answers
  // 500 instead of crashing the process on an unhandled Statement error.
  const { run } = require('../utils/dbHelpers');
  try {
    for (let index = 0; index < attendanceData.length; index++) {
      const record = attendanceData[index];
      await run(
        `INSERT OR REPLACE INTO attendance (student_id, course_id, session_id, date, status, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [resolved[index], courseId, sessionId || null, date, record.status, record.notes || '']
      );
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Attendance recorded successfully', count: attendanceData.length });
});

// Charge status of the students of a séance, to lock unpaid rows in the UI.
router.get('/session/:sessionId/roster', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
  const AttendanceService = require('../services/AttendanceService');
  try {
    const roster = await AttendanceService.sessionRoster(req.params.sessionId);
    res.json({ success: true, data: roster });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message, code: error.code });
  }
});

// Get student attendance summary
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  const { get, all } = require('../utils/dbHelpers');
  const { StudentLanguageService } = require('../services/StudentLanguageService');

  // User-first resolution like the write endpoints: UI ids are users-table ids.
  let resolvedId;
  try {
    resolvedId = await StudentLanguageService.resolveStudentId(req.params.studentId);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }

  // NOTE: the ownership check must complete BEFORE the query runs. The previous
  // code fired both in parallel, so a forbidden request could still get data
  // and crash with ERR_HTTP_HEADERS_SENT on the late 403.
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
        COUNT(*) as total_classes,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        ROUND(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as attendance_rate
      FROM attendance a
      JOIN courses c ON a.course_id = c.id
      WHERE a.student_id = ?
      GROUP BY a.course_id
    `, [resolvedId]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
