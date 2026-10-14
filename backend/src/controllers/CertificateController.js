const BaseController = require('./BaseController');
const certificateService = require('../services/CertificateService');

class CertificateController extends BaseController {
  constructor() {
    super(certificateService);
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
      const certificate = await this.service.findByIdWithDetails(req.params.id);
      res.json({ success: true, data: certificate });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const certificate = await this.service.createCertificate(req.body);
      res.status(201).json({ success: true, data: certificate });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const certificate = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: certificate });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Certificate deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async verify(req, res, next) {
    try {
      const certificate = await this.service.verifyCertificate(req.params.code);
      res.json({ success: true, data: certificate });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CertificateController();
