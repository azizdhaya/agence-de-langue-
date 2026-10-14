class BaseController {
  constructor(service) {
    this.service = service;
  }

  async index(req, res, next) {
    try {
      const result = await this.service.findAll(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const item = await this.service.findById(req.params.id);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const item = await this.service.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const item = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BaseController;
