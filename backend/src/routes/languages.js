const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const languageController = require('../controllers/LanguageController');

router.get('/', authenticateToken, (req, res, next) => languageController.index(req, res, next));
router.get('/:id', authenticateToken, (req, res, next) => languageController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.language.create), (req, res, next) => languageController.store(req, res, next));
router.put('/:id', authenticateToken, authorizeRoles('admin'), validate(schemas.language.update), (req, res, next) => languageController.update(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => languageController.destroy(req, res, next));

module.exports = router;
