const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const courseController = require('../controllers/CourseController');

// Reads are open to any authenticated user (students browse the catalogue);
// writes stay admin-only, as before.
router.get('/', authenticateToken, (req, res, next) => courseController.index(req, res, next));
router.get('/:id', authenticateToken, (req, res, next) => courseController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.course.create), (req, res, next) => courseController.store(req, res, next));
router.put('/:id', authenticateToken, authorizeRoles('admin'), validate(schemas.course.update), (req, res, next) => courseController.update(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => courseController.destroy(req, res, next));

// Enrolment with CEFR coherence check (§7.4): a level mismatch is refused with
// a 409 verdict unless the admin confirms explicitly ({ confirmed: true }).
// An optional groupId assigns the enrolment straight to one of the course's
// groups (capacity and course match enforced server-side).
router.post('/:id/enroll', authenticateToken, authorizeRoles('admin'), validate(schemas.course.enroll), (req, res, next) => courseController.enroll(req, res, next));
router.get('/:id/students', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res, next) => courseController.students(req, res, next));

module.exports = router;
