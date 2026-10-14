const studentLanguageService = require('../services/StudentLanguageService');
const StudentLanguageService = studentLanguageService.constructor;

function userId(req) {
  return req.user ? req.user.id : null;
}

function studentId(req) {
  return Number(req.params.studentId);
}

class StudentLanguageController {
  async index(req, res, next) {
    try {
      const profiles = await studentLanguageService.findByStudent(studentId(req));
      res.json({ success: true, data: profiles });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const profile = await studentLanguageService.findOne(studentId(req), req.params.languageId);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const profile = await studentLanguageService.createProfile(studentId(req), req.body, userId(req));
      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const profile = await studentLanguageService.updateProfile(
        studentId(req), req.params.languageId, req.body, userId(req)
      );
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async history(req, res, next) {
    try {
      const entries = await studentLanguageService.history(studentId(req), req.params.languageId);
      res.json({ success: true, data: entries });
    } catch (error) {
      next(error);
    }
  }

  async assess(req, res, next) {
    try {
      const result = await studentLanguageService.assess(
        studentId(req), req.params.languageId, req.body, userId(req)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async compatibleCourses(req, res, next) {
    try {
      const courses = await studentLanguageService.compatibleCourses(studentId(req), req.params.languageId);
      res.json({ success: true, data: courses });
    } catch (error) {
      next(error);
    }
  }

  async checkEnrollment(req, res, next) {
    try {
      const verdict = await studentLanguageService.checkEnrollment(studentId(req), req.query.courseId);
      res.json({ success: true, data: verdict });
    } catch (error) {
      next(error);
    }
  }

  async listBands(req, res, next) {
    try {
      const bands = await StudentLanguageService.listBands();
      res.json({ success: true, data: bands });
    } catch (error) {
      next(error);
    }
  }

  async updateBand(req, res, next) {
    try {
      const band = await StudentLanguageService.updateBand(req.params.bandId, req.body);
      res.json({ success: true, data: band });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StudentLanguageController();
