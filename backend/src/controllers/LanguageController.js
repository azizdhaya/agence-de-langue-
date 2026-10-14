const BaseController = require('./BaseController');
const languageService = require('../services/LanguageService');

class LanguageController extends BaseController {
  constructor() {
    super(languageService);
  }

  async index(req, res, next) {
    try {
      const languages = await this.service.findAll();
      res.json({ success: true, data: languages });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const language = await this.service.findById(req.params.id);
      res.json({ success: true, data: language });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const language = await this.service.create(req.body);
      res.status(201).json({ success: true, data: language });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const language = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: language });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Language deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LanguageController();
