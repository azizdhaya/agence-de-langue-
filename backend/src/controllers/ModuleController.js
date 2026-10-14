const BaseController = require('./BaseController');
const moduleService = require('../services/ModuleService');

/**
 * Catalogue of a course's programme: modules and their submodules.
 * Reads are open to authenticated users; writes are admin-only (route level).
 */
class ModuleController extends BaseController {
  constructor() {
    super(moduleService);
  }

  async listByCourse(req, res, next) {
    try {
      const modules = await this.service.listByCourse(req.params.courseId);
      res.json({ success: true, data: modules });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const module = await this.service.getById(req.params.id);
      res.json({ success: true, data: module });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const module = await this.service.create(req.params.courseId, req.body);
      res.status(201).json({ success: true, data: module });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const module = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: module });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Module deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async listSubmodules(req, res, next) {
    try {
      const submodules = await this.service.listSubmodules(req.params.moduleId);
      res.json({ success: true, data: submodules });
    } catch (error) {
      next(error);
    }
  }

  async storeSubmodule(req, res, next) {
    try {
      const submodule = await this.service.createSubmodule(req.params.moduleId, req.body);
      res.status(201).json({ success: true, data: submodule });
    } catch (error) {
      next(error);
    }
  }

  async updateSubmodule(req, res, next) {
    try {
      const submodule = await this.service.updateSubmodule(req.params.id, req.body);
      res.json({ success: true, data: submodule });
    } catch (error) {
      next(error);
    }
  }

  async destroySubmodule(req, res, next) {
    try {
      await this.service.deleteSubmodule(req.params.id);
      res.json({ success: true, message: 'Submodule deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ModuleController();
