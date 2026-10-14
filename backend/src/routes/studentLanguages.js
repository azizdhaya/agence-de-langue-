const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const controller = require('../controllers/StudentLanguageController');

// A student may read their own linguistic profile; staff may read any.
// Accepts either the students-table id or the users-table id in the URL,
// with the same user-first precedence as resolveStudentId: the student's own
// row always wins over a colliding table id.
const canReadProfile = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'teacher') return next();
  if (req.user.role === 'student') {
    const { get } = require('../utils/dbHelpers');
    const param = Number(req.params.studentId);
    return get('SELECT id FROM students WHERE user_id = ?', [req.user.id])
      .then((own) => {
        if (own && (own.id === param || req.user.id === param)) return next();
        return res.status(403).json({ success: false, error: { message: 'Access denied', code: 'FORBIDDEN' } });
      })
      .catch(next);
  }
  return res.status(403).json({ success: false, error: { message: 'Access denied', code: 'FORBIDDEN' } });
};

router.get('/', authenticateToken, canReadProfile, (req, res, next) => controller.index(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.studentLanguage.create), (req, res, next) => controller.store(req, res, next));
router.get('/check-enrollment', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res, next) => controller.checkEnrollment(req, res, next));
router.get('/:languageId', authenticateToken, canReadProfile, (req, res, next) => controller.show(req, res, next));
router.put('/:languageId', authenticateToken, authorizeRoles('admin'), validate(schemas.studentLanguage.update), (req, res, next) => controller.update(req, res, next));
router.get('/:languageId/history', authenticateToken, canReadProfile, (req, res, next) => controller.history(req, res, next));
router.post('/:languageId/assess', authenticateToken, authorizeRoles('admin', 'teacher'), validate(schemas.studentLanguage.assess), (req, res, next) => controller.assess(req, res, next));
router.get('/:languageId/compatible-courses', authenticateToken, canReadProfile, (req, res, next) => controller.compatibleCourses(req, res, next));

module.exports = router;
