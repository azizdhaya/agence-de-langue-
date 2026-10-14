const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const controller = require('../controllers/StudentLanguageController');

router.get('/', authenticateToken, authorizeRoles('admin', 'teacher'), (req, res, next) => controller.listBands(req, res, next));
router.put('/:bandId', authenticateToken, authorizeRoles('admin'), validate(schemas.placementBand.update), (req, res, next) => controller.updateBand(req, res, next));

module.exports = router;
