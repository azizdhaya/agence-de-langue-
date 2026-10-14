const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const documentController = require('../controllers/DocumentController');

router.get('/', authenticateToken, authorizeRoles('admin'), (req, res, next) => documentController.index(req, res, next));
router.get('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => documentController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.document.create), (req, res, next) => documentController.store(req, res, next));
router.put('/:id', authenticateToken, authorizeRoles('admin'), validate(schemas.document.update), (req, res, next) => documentController.update(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => documentController.destroy(req, res, next));

module.exports = router;
