const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const groupController = require('../controllers/GroupController');

router.get('/', authenticateToken, (req, res, next) => groupController.index(req, res, next));
router.get('/:id/students', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res, next) => groupController.members(req, res, next));
router.delete('/:id/students/:studentId', authenticateToken, authorizeRoles('admin'), (req, res, next) => groupController.removeMember(req, res, next));
router.get('/:id', authenticateToken, (req, res, next) => groupController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.group.create), (req, res, next) => groupController.store(req, res, next));
router.put('/:id', authenticateToken, authorizeRoles('admin'), validate(schemas.group.update), (req, res, next) => groupController.update(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => groupController.destroy(req, res, next));

module.exports = router;
