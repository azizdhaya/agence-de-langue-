const { get, all } = require('../utils/dbHelpers');
const AppError = require('../errors/AppError');

/**
 * Attendance guard for the finance rule: a submodule is billed before it
 * starts, so a student who still owes for a submodule cannot be marked present
 * in the séance that teaches it (grades and certificates are not affected).
 *
 * The link goes through the séance: `sessions.submodule_id` names the submodule
 * being taught, and the charge lives on `enrollment_submodules`. No séance or a
 * séance without a submodule means nobody can be resolved, so nobody is blocked
 * on that basis.
 */
class AttendanceService {
  /** The séance with the submodule it teaches and the course of its group. */
  static async loadSession(sessionId) {
    const id = Number(sessionId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(`Invalid session id: ${sessionId}`, 400, 'INVALID_SESSION');
    }
    const session = await get(
      `SELECT s.id, s.date, s.submodule_id, g.course_id,
              ms.name AS submodule_name
       FROM sessions s
       LEFT JOIN groups g ON g.id = s.group_id
       LEFT JOIN module_submodules ms ON ms.id = s.submodule_id
       WHERE s.id = ?`,
      [id]
    );
    if (!session) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
    return session;
  }

  /**
   * Among the given student ids (internal `students.id`, what the attendance
   * write resolves to), the ones that still owe for the séance's submodule. An
   * empty array means everyone is clear to attend.
   */
  static async blockedStudents(sessionId, studentIds = []) {
    if (sessionId === undefined || sessionId === null || sessionId === '') return [];
    const session = await AttendanceService.loadSession(sessionId);
    if (!session.submodule_id) return [];

    const ids = [...new Set(studentIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(', ');
    return await all(
      `SELECT DISTINCT st.id AS student_id, u.first_name || ' ' || u.last_name AS name
       FROM enrollment_submodules es
       JOIN enrollment_modules em ON em.id = es.enrollment_module_id
       JOIN enrollments e ON e.id = em.enrollment_id
       JOIN students st ON st.id = e.student_id
       JOIN users u ON u.id = st.user_id
       WHERE es.submodule_id = ? AND es.status = 'unpaid'
         AND st.id IN (${placeholders})
       ORDER BY name`,
      [session.submodule_id, ...ids]
    );
  }

  /** Refuse the whole write when any of the students still owes the submodule. */
  static async assertAllowed(sessionId, studentIds) {
    const blocked = await AttendanceService.blockedStudents(sessionId, studentIds);
    if (blocked.length > 0) {
      const names = blocked.map((row) => row.name).join(', ');
      throw new AppError(
        `Sous-module impayé : présence impossible pour ${names}. Réglez l'échéance d'abord.`,
        403,
        'SUBMODULE_UNPAID'
      );
    }
  }

  /**
   * For a séance, the charge status of each student enrolled in its course, to
   * let the UI lock the rows that must not be marked present.
   */
  static async sessionRoster(sessionId) {
    const session = await AttendanceService.loadSession(sessionId);

    const students = session.course_id
      ? await all(
          `SELECT u.id AS student_id, u.first_name, u.last_name,
                  MAX(CASE WHEN es.status = 'paid' THEN 1 ELSE 0 END) AS has_paid,
                  MAX(CASE WHEN es.status = 'unpaid' THEN 1 ELSE 0 END) AS has_unpaid
           FROM users u
           JOIN students st ON st.user_id = u.id
           JOIN enrollments e ON e.student_id = st.id AND e.course_id = ?
           LEFT JOIN enrollment_modules em ON em.enrollment_id = e.id
           LEFT JOIN enrollment_submodules es
             ON es.enrollment_module_id = em.id AND es.submodule_id = ?
           GROUP BY u.id
           ORDER BY u.first_name, u.last_name`,
          [session.course_id, session.submodule_id]
        )
      : [];

    return {
      session: {
        id: session.id,
        date: session.date,
        course_id: session.course_id,
        submodule_id: session.submodule_id,
        submodule_name: session.submodule_name || null
      },
      students: students.map((row) => ({
        student_id: row.student_id,
        name: `${row.first_name} ${row.last_name}`,
        status: Number(row.has_unpaid) === 1 ? 'unpaid' : Number(row.has_paid) === 1 ? 'paid' : 'not_charged'
      }))
    };
  }
}

module.exports = AttendanceService;
