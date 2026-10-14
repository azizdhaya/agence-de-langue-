const BaseController = require('./BaseController');
const skillService = require('../services/SkillService');

class SkillController extends BaseController {
  constructor() {
    super(skillService);
  }

  async index(req, res, next) {
    try {
      const skills = await this.service.findAll();
      res.json({ success: true, data: skills });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const skill = await this.service.findById(req.params.id);
      res.json({ success: true, data: skill });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const skill = await this.service.create(req.body);
      res.status(201).json({ success: true, data: skill });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const skill = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: skill });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Skill deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SkillController();
