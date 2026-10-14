const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

/**
 * Catalogue modules (course_modules). A module is an ordered part of a course;
 * it has no price of its own. Rows are returned snake_case, like the rest of
 * the pedagogical API.
 */
class ModuleRepository extends BaseRepository {
  constructor() {
    super('course_modules');
  }

  findByCourse(courseId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM course_modules WHERE course_id = ? ORDER BY position ASC, id ASC`,
        [courseId],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });
  }

  findRowById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM course_modules WHERE id = ?`, [id], (err, row) =>
        err ? reject(err) : resolve(row)
      );
    });
  }

  /** How many student registrations reference this module (blocks deletion). */
  countRegistrations(moduleId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) AS n FROM enrollment_modules WHERE module_id = ?`,
        [moduleId],
        (err, row) => (err ? reject(err) : resolve(row ? row.n : 0))
      );
    });
  }
}

module.exports = new ModuleRepository();
