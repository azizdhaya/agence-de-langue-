const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

/**
 * Catalogue submodules (module_submodules): the billable leaf. Each carries the
 * catalogue price in integer millimes. Rows are returned snake_case.
 */
class SubmoduleRepository extends BaseRepository {
  constructor() {
    super('module_submodules');
  }

  findByModule(moduleId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM module_submodules WHERE module_id = ? ORDER BY position ASC, id ASC`,
        [moduleId],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });
  }

  findRowById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM module_submodules WHERE id = ?`, [id], (err, row) =>
        err ? reject(err) : resolve(row)
      );
    });
  }

  /** How many student charges reference this submodule (blocks deletion). */
  countCharges(submoduleId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) AS n FROM enrollment_submodules WHERE submodule_id = ?`,
        [submoduleId],
        (err, row) => (err ? reject(err) : resolve(row ? row.n : 0))
      );
    });
  }
}

module.exports = new SubmoduleRepository();
