const BaseRepository = require('./BaseRepository');
const { get, all } = require('../utils/dbHelpers');

class LevelRepository extends BaseRepository {
  constructor() {
    super('levels');
  }

  async findAllActive() {
    return this.findAll({ where: { is_active: 1 }, order: 'order_index ASC' });
  }

  async findByCode(code) {
    return this.findOne({ code });
  }

  async findByLanguage(languageId) {
    return this.findAll({ where: { language_id: languageId, is_active: 1 }, order: 'order_index ASC' });
  }

  /**
   * Every level of a framework in true CEFR order (tens grid: A1=10, A1.1=11...).
   * @param {string} [framework='CEFR']
   * @param {boolean} [activeOnly=true]
   */
  async findOrdered(framework = 'CEFR', activeOnly = true) {
    const where = { framework };
    if (activeOnly) where.is_active = 1;
    return this.findAll({ where, order: 'order_index ASC' });
  }

  /** Main levels only (A1..C2), i.e. rows without a parent. */
  async findMainLevels(framework = 'CEFR') {
    return await all(
      `SELECT * FROM levels WHERE framework = ? AND parent_code IS NULL AND is_active = 1 ORDER BY order_index ASC`,
      [framework]
    );
  }

  /** Sub-levels of one main level (A1 -> A1.1, A1.2). */
  async findSubLevels(parentCode, framework = 'CEFR') {
    return await all(
      `SELECT * FROM levels WHERE framework = ? AND parent_code = ? AND is_active = 1 ORDER BY order_index ASC`,
      [framework, parentCode]
    );
  }

  /**
   * How many rows reference this level, across courses and student profiles.
   * Used to refuse deletion of a level that is in use.
   * @returns {Promise<{courses: number, profiles: number, total: number}>}
   */
  async countUsage(id) {
    const courses = await get('SELECT COUNT(*) AS c FROM courses WHERE level_id = ?', [id]);
    const profiles = await get(
      `SELECT COUNT(*) AS c FROM student_languages
       WHERE global_level_id = ? OR listening_level_id = ? OR reading_level_id = ?
          OR speaking_level_id = ? OR writing_level_id = ?`,
      [id, id, id, id, id]
    );
    const history = await get(
      'SELECT COUNT(*) AS c FROM level_history WHERE old_level_id = ? OR new_level_id = ?',
      [id, id]
    );
    const total = (courses ? courses.c : 0) + (profiles ? profiles.c : 0);
    return { courses: courses ? courses.c : 0, profiles: profiles ? profiles.c : 0, history: history ? history.c : 0, total };
  }
}

module.exports = new LevelRepository();
