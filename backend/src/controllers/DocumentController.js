const BaseController = require('./BaseController');
const documentService = require('../services/DocumentService');

class DocumentController extends BaseController {
  constructor() {
    super(documentService);
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
      const document = await this.service.findByIdWithDetails(req.params.id);
      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const document = await this.service.create(req.body);
      res.status(201).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const document = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DocumentController();
