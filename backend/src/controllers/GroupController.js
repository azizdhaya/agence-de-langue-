const BaseController = require('./BaseController');
const groupService = require('../services/GroupService');

class GroupController extends BaseController {
  constructor() {
    super(groupService);
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
      const group = await this.service.findByIdWithDetails(req.params.id);
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const group = await this.service.create(req.body);
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const group = await this.service.update(req.params.id, req.body);
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async members(req, res, next) {
    try {
      const courseService = require('../services/CourseService');
      const students = await courseService.groupStudents(req.params.id);
      res.json({ success: true, data: students });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req, res, next) {
    try {
      const courseService = require('../services/CourseService');
      const result = await courseService.removeFromGroup(req.params.id, req.params.studentId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new GroupController();
