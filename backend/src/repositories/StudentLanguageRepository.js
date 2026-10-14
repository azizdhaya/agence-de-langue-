const BaseRepository = require('./BaseRepository');
const { get, all, run, transaction } = require('../utils/dbHelpers');

/** Level columns of student_languages, in a fixed order. */
const LEVEL_COLUMNS = [
  'global_level_id',
  'listening_level_id',
  'reading_level_id',
  'speaking_level_id',
  'writing_level_id'
];

class StudentLanguageRepository extends BaseRepository {
  constructor() {
    super('student_languages');
  }

  /** Column list selecting a profile with every level code joined. */
  static selectWithLevels(alias = 'sl') {
    return `${alias}.*,
      gl.code AS global_level_code, gl.order_index AS global_level_order,
      li.code AS listening_level_code, re.code AS reading_level_code,
      sp.code AS speaking_level_code, wr.code AS writing_level_code,
      l.code AS language_code, l.name AS language_name, l.flag AS language_flag`;
  }

  static joinLevels(alias = 'sl') {
    return `LEFT JOIN levels gl ON gl.id = ${alias}.global_level_id
      LEFT JOIN levels li ON li.id = ${alias}.listening_level_id
      LEFT JOIN levels re ON re.id = ${alias}.reading_level_id
      LEFT JOIN levels sp ON sp.id = ${alias}.speaking_level_id
      LEFT JOIN levels wr ON wr.id = ${alias}.writing_level_id
      JOIN languages l ON l.id = ${alias}.language_id`;
  }

  async findByStudent(studentId) {
    return await all(
      `SELECT ${StudentLanguageRepository.selectWithLevels()}
       FROM student_languages sl
       ${StudentLanguageRepository.joinLevels()}
       WHERE sl.student_id = ?
       ORDER BY l.name ASC`,
      [studentId]
    );
  }

  async findByStudentAndLanguage(studentId, languageId) {
    return await get(
      `SELECT ${StudentLanguageRepository.selectWithLevels()}
       FROM student_languages sl
       ${StudentLanguageRepository.joinLevels()}
       WHERE sl.student_id = ? AND sl.language_id = ?`,
      [studentId, languageId]
    );
  }

  async findHistory(studentLanguageId) {
    return await all(
      `SELECT h.*, ol.code AS old_level_code, nl.code AS new_level_code,
              u.email AS changed_by_email,
              u.first_name || ' ' || u.last_name AS changed_by_name
       FROM level_history h
       LEFT JOIN levels ol ON ol.id = h.old_level_id
       JOIN levels nl ON nl.id = h.new_level_id
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.student_language_id = ?
       ORDER BY h.created_at DESC, h.id DESC`,
      [studentLanguageId]
    );
  }

  /**
   * Insert a profile and its first history entry atomically. The history entry
   * has no old level: a first assessment is a beginning, not a change.
   */
  async createWithHistory(profile, history) {
    return await transaction(async () => {
      const cols = Object.keys(profile);
      const result = await run(
        `INSERT INTO student_languages (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        Object.values(profile)
      );
      const id = result.lastID;
      if (history && history.new_level_id) {
        await run(
          `INSERT INTO level_history
             (student_language_id, old_level_id, new_level_id, changed_by, reason, method, score)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, history.old_level_id ?? null, history.new_level_id,
           history.changed_by ?? null, history.reason ?? null,
           history.method ?? null, history.score ?? null]
        );
      }
      return id;
    });
  }

  /**
   * Update a profile and append a history entry when the global level changed.
   */
  async updateWithHistory(id, patch, history) {
    return await transaction(async () => {
      const cols = Object.keys(patch);
      if (cols.length > 0) {
        await run(
          `UPDATE student_languages SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [...Object.values(patch), id]
        );
      }
      if (history && history.new_level_id) {
        await run(
          `INSERT INTO level_history
             (student_language_id, old_level_id, new_level_id, changed_by, reason, method, score)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, history.old_level_id ?? null, history.new_level_id,
           history.changed_by ?? null, history.reason ?? null,
           history.method ?? null, history.score ?? null]
        );
      }
    });
  }
}

module.exports = new StudentLanguageRepository();
module.exports.LEVEL_COLUMNS = LEVEL_COLUMNS;
