const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const levelController = require('../controllers/LevelController');

router.get('/', authenticateToken, (req, res, next) => levelController.index(req, res, next));
router.get('/:id', authenticateToken, (req, res, next) => levelController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.level.create), (req, res, next) => levelController.store(req, res, next));
router.put('/:id', authenticateToken, authorizeRoles('admin'), validate(schemas.level.update), (req, res, next) => levelController.update(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => levelController.destroy(req, res, next));

module.exports = router;
