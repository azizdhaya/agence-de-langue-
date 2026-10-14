const BaseService = require('./BaseService');
const BaseRepository = require('../repositories/BaseRepository');
const levelRepository = require('../repositories/LevelRepository');
const AppError = require('../errors/AppError');

class LevelService extends BaseService {
  constructor() {
    super(levelRepository);
  }

  async findAllActive() {
    return await this.repository.findAllActive();
  }

  async findByCode(code) {
    return await this.repository.findByCode(code);
  }

  async findByLanguage(languageId) {
    return await this.repository.findByLanguage(languageId);
  }

  /**
   * Full CEFR scale in display order, optionally including inactive rows.
   * Powers the admin settings table (§8).
   */
  async findOrdered({ framework = 'CEFR', activeOnly = true } = {}) {
    return await this.repository.findOrdered(framework, activeOnly);
  }

  async findMainLevels(framework = 'CEFR') {
    const rows = await this.repository.findMainLevels(framework);
    return rows.map((row) => BaseRepository.toCamelCase(row));
  }

  async findSubLevels(parentCode, framework = 'CEFR') {
    const parent = await this.repository.findByCode(parentCode);
    if (!parent) {
      throw new AppError(`Unknown level: ${parentCode}`, 404, 'LEVEL_NOT_FOUND');
    }
    // findSubLevels runs raw SQL (snake_case) while findByCode returns
    // camelCase: normalise so callers never mix both shapes in one list.
    const rows = await this.repository.findSubLevels(parentCode, framework);
    return rows.map((row) => BaseRepository.toCamelCase(row));
  }

  /**
   * Compare two level codes by their CEFR order.
   * @returns {Promise<number>} negative if a < b, 0 if equal, positive if a > b
   */
  async compare(codeA, codeB) {
    const [a, b] = await Promise.all([
      this.repository.findByCode(codeA),
      this.repository.findByCode(codeB)
    ]);
    if (!a || !b) {
      throw new AppError(`Unknown level: ${!a ? codeA : codeB}`, 404, 'LEVEL_NOT_FOUND');
    }
    return a.order_index - b.order_index;
  }

  /**
   * Delete a level only when nothing references it. Courses, student profiles
   * and history rows all block deletion (§11).
   */
  async delete(id) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Level not found', 404, 'NOT_FOUND');
    }
    const usage = await this.repository.countUsage(id);
    if (usage.total > 0) {
      throw new AppError(
        `Cannot delete level ${existing.code}: used by ${usage.courses} course(s) and ${usage.profiles} student profile(s). Deactivate it instead.`,
        409,
        'LEVEL_IN_USE'
      );
    }
    return await this.repository.delete(id);
  }
}

module.exports = new LevelService();
