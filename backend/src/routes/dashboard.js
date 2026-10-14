const express = require('express');
const db = require('../models/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

/**
 * Build the list of SQL fragments shared by the student dashboard.
 * `userId` is a users.id value.
 */
function studentStats(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT
        (SELECT COUNT(*) FROM enrollments e
           JOIN students s ON e.student_id = s.id
          WHERE s.user_id = ? AND e.status = 'active') as active_courses,
        (SELECT COUNT(*) FROM attendance a
           JOIN students s ON a.student_id = s.id
          WHERE s.user_id = ?) as attendance_records,
        (SELECT COUNT(*) FROM attendance a
           JOIN students s ON a.student_id = s.id
          WHERE s.user_id = ? AND a.status = 'present') as present_records,
        (SELECT COUNT(*) FROM grades g
           JOIN students s ON g.student_id = s.id
          WHERE s.user_id = ?) as total_grades,
        (SELECT COUNT(*) FROM certificates c
           JOIN students s ON c.student_id = s.id
          WHERE s.user_id = ? AND c.status = 'active') as certificates,
        (SELECT COUNT(*) FROM notifications n
          WHERE n.user_id = ? AND n.is_read = 0) as unread_notifications`,
      [userId, userId, userId, userId, userId, userId],
      (err, row) => (err ? reject(err) : resolve(row))
    );
  });
}

/** Get the student's level as stored on the students record. */
function studentLevel(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT level FROM students WHERE user_id = ?', [userId], (err, row) =>
      err ? reject(err) : resolve(row?.level || 'beginner')
    );
  });
}

/** Average of all grades expressed as a percentage. */
function studentAverage(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT ROUND(AVG(g.score * 100.0 / g.max_score), 1) as average
         FROM grades g
         JOIN students s ON g.student_id = s.id
        WHERE s.user_id = ?`,
      [userId],
      (err, row) => (err ? reject(err) : resolve(row?.average ?? 0))
    );
  });
}

/** Upcoming sessions for the student's enrolled groups. */
function studentUpcomingSessions(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT s.id, s.date, s.start_time, s.end_time, s.room,
              g.name AS group_name, c.name AS course_name, c.language, c.level
         FROM sessions s
         JOIN groups g ON s.group_id = g.id
         JOIN courses c ON g.course_id = c.id
         JOIN enrollments e ON e.group_id = g.id AND e.status = 'active'
         JOIN students st ON e.student_id = st.id
        WHERE st.user_id = ?
          AND s.status = 'scheduled'
          AND date(s.date) >= date('now')
        ORDER BY s.date ASC, s.start_time ASC
        LIMIT 5`,
      [userId],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });
}

/** Student grades with the course name and, when set, the skill. */
function studentGrades(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT g.id, g.assessment_type, g.score, g.max_score, g.date, g.notes,
              c.name AS course_name, sk.name AS skill_name
         FROM grades g
         JOIN students s ON g.student_id = s.id
         JOIN courses c ON g.course_id = c.id
         LEFT JOIN skills sk ON g.skill_id = sk.id
        WHERE s.user_id = ?
        ORDER BY g.date DESC
        LIMIT 20`,
      [userId],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });
}

// Get dashboard statistics (admin)
router.get('/stats', authenticateToken, authorizeRoles('admin'), (req, res) => {
  db.get(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'student') as total_students,
      (SELECT COUNT(*) FROM users WHERE role = 'teacher') as total_teachers,
      (SELECT COUNT(*) FROM courses WHERE status = 'active') as active_courses,
      (SELECT COUNT(*) FROM enrollments WHERE status = 'active') as active_enrollments,
      (SELECT COUNT(*) FROM announcements WHERE expires_at IS NULL OR expires_at > datetime('now')) as active_announcements
  `, [], (err, stats) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(stats);
  });
});

// Get recent activities
router.get('/recent', authenticateToken, authorizeRoles('admin'), (req, res) => {
  db.all(`
    SELECT 'enrollment' as type, e.id, u.first_name || ' ' || u.last_name as person, c.name as detail, e.enrollment_date as date
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN courses c ON e.course_id = c.id
    UNION ALL
    SELECT 'announcement' as type, a.id, u.first_name || ' ' || u.last_name as person, a.title as detail, a.created_at as date
    FROM announcements a
    JOIN users u ON a.author_id = u.id
    ORDER BY date DESC
    LIMIT 10
  `, [], (err, activities) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(activities);
  });
});

// Get course enrollment stats
router.get('/enrollments', authenticateToken, authorizeRoles('admin'), (req, res) => {
  db.all(`
    SELECT c.name, c.language, c.level, COUNT(e.student_id) as enrolled_count
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
    WHERE c.status = 'active'
    GROUP BY c.id
    ORDER BY enrolled_count DESC
  `, [], (err, enrollments) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(enrollments);
  });
});

/**
 * Dashboard for the logged-in student.
 * Aggregates courses, attendance, grades, fees and certificates from the DB
 * so the UI never has to invent values.
 */
router.get('/student', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const userId = req.user.id;

    const [stats, level, average, sessions, grades] = await Promise.all([
      studentStats(userId),
      studentLevel(userId),
      studentAverage(userId),
      studentUpcomingSessions(userId),
      studentGrades(userId)
    ]);

    const attendanceRate =
      stats.attendance_records > 0
        ? Math.round((stats.present_records / stats.attendance_records) * 100)
        : null;

    res.json({
      success: true,
      data: {
        level,
        activeCourses: stats.active_courses,
        attendanceRate,
        averageScore: average,
        certificates: stats.certificates,
        unreadNotifications: stats.unread_notifications,
        upcomingSessions: sessions,
        recentGrades: grades
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Dashboard for the logged-in teacher.
 * Aggregates assigned groups, sessions, attendance taken and grading workload.
 */
router.get('/teacher', authenticateToken, authorizeRoles('teacher'), (req, res) => {
  const userId = req.user.id;

  db.get(
    `SELECT
      (SELECT COUNT(*) FROM groups g
         JOIN teachers t ON g.teacher_id = t.id
        WHERE t.user_id = ? AND g.status = 'active') as active_groups,
      (SELECT COUNT(*) FROM sessions s
         JOIN teachers t ON s.teacher_id = t.id
        WHERE t.user_id = ? AND s.status = 'scheduled'
          AND date(s.date) >= date('now')) as upcoming_sessions,
      (SELECT COUNT(*) FROM enrollments e
         JOIN groups g ON e.group_id = g.id
         JOIN teachers t ON g.teacher_id = t.id
        WHERE t.user_id = ? AND e.status = 'active') as total_students,
      (SELECT COUNT(*) FROM attendance a
         JOIN courses c ON a.course_id = c.id
         JOIN teachers t ON c.teacher_id = t.id
        WHERE t.user_id = ?) as attendance_records,
      (SELECT COUNT(*) FROM grades g
         JOIN courses c ON g.course_id = c.id
         JOIN teachers t ON c.teacher_id = t.id
        WHERE t.user_id = ?) as total_grades`,
    [userId, userId, userId, userId, userId],
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      db.all(
        `SELECT s.id, s.date, s.start_time, s.end_time, s.room, s.status,
                g.name AS group_name, c.name AS course_name, c.language
           FROM sessions s
           JOIN groups g ON s.group_id = g.id
           JOIN courses c ON g.course_id = c.id
           JOIN teachers t ON s.teacher_id = t.id
          WHERE t.user_id = ? AND s.status = 'scheduled'
            AND date(s.date) >= date('now')
          ORDER BY s.date ASC, s.start_time ASC
          LIMIT 5`,
        [userId],
        (err, sessions) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          db.all(
            `SELECT g.id AS group_id, g.name AS group_name,
                    COUNT(DISTINCT e.student_id) AS student_count,
                    COUNT(gr.id) AS grade_count,
                    ROUND(AVG(gr.score * 100.0 / gr.max_score), 1) AS average_score
               FROM groups g
               JOIN teachers t ON g.teacher_id = t.id
               LEFT JOIN enrollments e ON e.group_id = g.id AND e.status = 'active'
               LEFT JOIN grades gr ON gr.course_id = g.course_id
              WHERE t.user_id = ? AND g.status = 'active'
              GROUP BY g.id
              ORDER BY g.name`,
            [userId],
            (err, groups) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              res.json({
                success: true,
                data: {
                  activeGroups: stats.active_groups,
                  upcomingSessions: stats.upcoming_sessions,
                  totalStudents: stats.total_students,
                  attendanceRecords: stats.attendance_records,
                  totalGrades: stats.total_grades,
                  sessions,
                  groups
                }
              });
            }
          );
        }
      );
    }
  );
});

module.exports = router;