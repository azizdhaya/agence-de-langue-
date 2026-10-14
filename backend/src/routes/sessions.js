const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const sessionController = require('../controllers/SessionController');

router.get('/', authenticateToken, (req, res, next) => sessionController.index(req, res, next));
router.get('/:id', authenticateToken, (req, res, next) => sessionController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin', 'teacher'), validate(schemas.session.create), (req, res, next) => sessionController.store(req, res, next));
router.put('/:id', authenticateToken, authorizeRoles('admin', 'teacher'), validate(schemas.session.update), (req, res, next) => sessionController.update(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => sessionController.destroy(req, res, next));

module.exports = router;
