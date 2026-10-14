const BaseService = require('./BaseService');
const moduleRepository = require('../repositories/ModuleRepository');
const submoduleRepository = require('../repositories/SubmoduleRepository');
const { get } = require('../utils/dbHelpers');
const { toMillimes, fromMillimes } = require('../utils/money');
const AppError = require('../errors/AppError');

/**
 * Catalogue of a course's programme: ordered modules, each made of ordered
 * submodules. The module has no price; its price is the sum of its submodules.
 * Only admins write here (enforced at the route level).
 */
class ModuleService extends BaseService {
  constructor() {
    super(moduleRepository);
  }

  static async assertCourse(courseId) {
    const course = await get('SELECT id FROM courses WHERE id = ?', [Number(courseId)]);
    if (!course) {
      throw new AppError('Course not found', 404, 'NOT_FOUND');
    }
    return course.id;
  }

  static toSubmodule(row) {
    return {
      ...row,
      price: fromMillimes(row.price_millimes)
    };
  }

  static toModule(row, submodules = []) {
    return {
      ...row,
      price_millimes: submodules.reduce((total, sub) => total + Number(sub.price_millimes || 0), 0),
      submodule_count: submodules.length,
      submodules
    };
  }

  /** Modules of a course, each with its ordered submodules and total price. */
  async listByCourse(courseId) {
    const id = await ModuleService.assertCourse(courseId);
    const modules = await moduleRepository.findByCourse(id);
    const result = [];
    for (const module of modules) {
      const subs = (await submoduleRepository.findByModule(module.id)).map(ModuleService.toSubmodule);
      result.push(ModuleService.toModule(module, subs));
    }
    return result;
  }

  /** One module with its course, submodules and total price. */
  async getById(id) {
    const module = await moduleRepository.findRowById(Number(id));
    if (!module) {
      throw new AppError('Module not found', 404, 'NOT_FOUND');
    }
    const subs = (await submoduleRepository.findByModule(module.id)).map(ModuleService.toSubmodule);
    const course = await get('SELECT id, name FROM courses WHERE id = ?', [module.course_id]);
    return { ...ModuleService.toModule(module, subs), course: course || null };
  }

  static async nextPosition(courseId) {
    const row = await get(
      'SELECT COALESCE(MAX(position), -1) AS max FROM course_modules WHERE course_id = ?',
      [courseId]
    );
    return (row?.max ?? -1) + 1;
  }

  async create(courseId, data) {
    const id = await ModuleService.assertCourse(courseId);
    const position = data.position !== undefined && data.position !== null
      ? Number(data.position)
      : await ModuleService.nextPosition(id);
    const created = await moduleRepository.create({
      course_id: id,
      name: data.name,
      description: data.description ?? null,
      position,
      discount_percent: data.discountPercent !== undefined ? Number(data.discountPercent) : 0,
      status: data.status || 'active'
    });
    return await this.getById(created.id);
  }

  async update(id, data) {
    const existing = await moduleRepository.findRowById(Number(id));
    if (!existing) {
      throw new AppError('Module not found', 404, 'NOT_FOUND');
    }
    const patch = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.position !== undefined) patch.position = Number(data.position);
    if (data.discountPercent !== undefined) patch.discount_percent = Number(data.discountPercent);
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length > 0) {
      await moduleRepository.update(existing.id, patch);
    }
    return await this.getById(existing.id);
  }

  /**
   * Delete a module together with its submodules. Refused while a student is
   * registered to it: an active debt must not vanish silently.
   */
  async delete(id) {
    const existing = await moduleRepository.findRowById(Number(id));
    if (!existing) {
      throw new AppError('Module not found', 404, 'NOT_FOUND');
    }
    const registrations = await moduleRepository.countRegistrations(existing.id);
    if (registrations > 0) {
      throw new AppError(
        `Cannot delete module "${existing.name}": ${registrations} student registration(s) reference it.`,
        409,
        'MODULE_IN_USE'
      );
    }
    return await moduleRepository.delete(existing.id);
  }

  // ---------------------------------------------------------------- submodules

  static async assertModule(moduleId) {
    const module = await moduleRepository.findRowById(Number(moduleId));
    if (!module) {
      throw new AppError('Module not found', 404, 'NOT_FOUND');
    }
    return module;
  }

  static async nextSubmodulePosition(moduleId) {
    const row = await get(
      'SELECT COALESCE(MAX(position), -1) AS max FROM module_submodules WHERE module_id = ?',
      [moduleId]
    );
    return (row?.max ?? -1) + 1;
  }

  async listSubmodules(moduleId) {
    const module = await ModuleService.assertModule(moduleId);
    const subs = await submoduleRepository.findByModule(module.id);
    return subs.map(ModuleService.toSubmodule);
  }

  async createSubmodule(moduleId, data) {
    const module = await ModuleService.assertModule(moduleId);
    const position = data.position !== undefined && data.position !== null
      ? Number(data.position)
      : await ModuleService.nextSubmodulePosition(module.id);
    const created = await submoduleRepository.create({
      module_id: module.id,
      name: data.name,
      description: data.description ?? null,
      position,
      price_millimes: toMillimes(data.price),
      status: data.status || 'active'
    });
    return ModuleService.toSubmodule(await submoduleRepository.findRowById(created.id));
  }

  async updateSubmodule(id, data) {
    const existing = await submoduleRepository.findRowById(Number(id));
    if (!existing) {
      throw new AppError('Submodule not found', 404, 'NOT_FOUND');
    }
    const patch = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.position !== undefined) patch.position = Number(data.position);
    if (data.price !== undefined) patch.price_millimes = toMillimes(data.price);
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length > 0) {
      // Catalogue edits only affect future registrations: existing charges hold
      // their own price snapshot and are never rewritten here.
      await submoduleRepository.update(existing.id, patch);
    }
    return ModuleService.toSubmodule(await submoduleRepository.findRowById(existing.id));
  }

  /** Delete a submodule. Refused while a student charge references it. */
  async deleteSubmodule(id) {
    const existing = await submoduleRepository.findRowById(Number(id));
    if (!existing) {
      throw new AppError('Submodule not found', 404, 'NOT_FOUND');
    }
    const charges = await submoduleRepository.countCharges(existing.id);
    if (charges > 0) {
      throw new AppError(
        `Cannot delete submodule "${existing.name}": ${charges} student charge(s) reference it.`,
        409,
        'SUBMODULE_IN_USE'
      );
    }
    return await submoduleRepository.delete(existing.id);
  }

  /** Active submodules of a module, ordered. Used when charges are created. */
  async activeSubmodules(moduleId) {
    const subs = await submoduleRepository.findByModule(Number(moduleId));
    return subs.filter((sub) => sub.status === 'active');
  }
}

module.exports = new ModuleService();
