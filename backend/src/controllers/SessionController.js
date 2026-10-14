const BaseController = require('./BaseController');
const sessionService = require('../services/SessionService');

class SessionController extends BaseController {
  constructor() {
    super(sessionService);
  }

  async index(req, res, next) {
    try {
      const result = await this.service.findAllWithDetails(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const session = await this.service.findByIdWithDetails(req.params.id);
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const session = await this.service.create(req.body);
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const session = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SessionController();
