const BaseController = require('./BaseController');
const studentService = require('../services/StudentService');

class StudentController extends BaseController {
  constructor() {
    super(studentService);
  }

  async index(req, res, next) {
    try {
      const result = await this.service.findAllWithUsers(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const student = await this.service.findByIdWithUser(req.params.id);
      res.json({ success: true, data: student });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const student = await this.service.createStudent(req.body, req.body);
      res.status(201).json({ success: true, data: student });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const student = await this.service.updateStudent(req.params.id, req.body, req.body);
      res.json({ success: true, data: student });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StudentController();
