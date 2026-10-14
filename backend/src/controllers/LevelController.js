const BaseController = require('./BaseController');
const levelService = require('../services/LevelService');

class LevelController extends BaseController {
  constructor() {
    super(levelService);
  }

  async index(req, res, next) {
    try {
      const { framework = 'CEFR', parent, active } = req.query;
      if (parent) {
        const [main, subs] = await Promise.all([
          this.service.findByCode(parent),
          this.service.findSubLevels(parent, framework)
        ]);
        // The filter shows the main level together with its sub-levels.
        return res.json({ success: true, data: main ? [main, ...subs] : subs });
      }
      const levels = await this.service.findOrdered({
        framework,
        activeOnly: active === undefined ? true : active !== 'false'
      });
      res.json({ success: true, data: levels });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const level = await this.service.findById(req.params.id);
      res.json({ success: true, data: level });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const level = await this.service.create(req.body);
      res.status(201).json({ success: true, data: level });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const level = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: level });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Level deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LevelController();
