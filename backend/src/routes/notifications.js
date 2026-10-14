const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const notificationController = require('../controllers/NotificationController');

router.get('/', authenticateToken, (req, res, next) => notificationController.index(req, res, next));
router.get('/mine', authenticateToken, (req, res, next) => notificationController.mine(req, res, next));
router.get('/:id', authenticateToken, (req, res, next) => notificationController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.notification.create), (req, res, next) => notificationController.store(req, res, next));
router.put('/:id/read', authenticateToken, (req, res, next) => notificationController.markAsRead(req, res, next));
router.put('/read-all', authenticateToken, (req, res, next) => notificationController.markAllAsRead(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => notificationController.destroy(req, res, next));

module.exports = router;