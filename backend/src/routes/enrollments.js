const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const courseController = require('../controllers/CourseController');

// Delete an enrolment for a course.
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('admin'),
  (req, res, next) => {
    req.params.enrollmentId = req.params.id;
    return courseController.unenroll(req, res, next);
  }
);

module.exports = router;
