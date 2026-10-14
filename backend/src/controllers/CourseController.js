const BaseController = require('./BaseController');
const courseService = require('../services/CourseService');

class CourseController extends BaseController {
  constructor() {
    super(courseService);
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
      const course = await this.service.findByIdWithDetails(req.params.id);
      res.json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const course = await this.service.create(req.body);
      res.status(201).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const course = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Course deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async enroll(req, res, next) {
    try {
      const result = await this.service.enrollStudent(
        req.body.studentId,
        req.params.id,
        req.body.confirmed === true,
        req.body.groupId ?? null,
        { moduleIds: req.body.moduleIds, priceOverrides: req.body.priceOverrides }
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async students(req, res, next) {
    try {
      const students = await this.service.findStudents(req.params.id);
      res.json({ success: true, data: students });
    } catch (error) {
      next(error);
    }
  }

  async unenroll(req, res, next) {
    try {
      const result = await this.service.unenroll(req.params.enrollmentId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CourseController();
