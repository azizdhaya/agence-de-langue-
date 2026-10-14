const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const skillController = require('../controllers/SkillController');

router.get('/', authenticateToken, (req, res, next) => skillController.index(req, res, next));
router.get('/:id', authenticateToken, (req, res, next) => skillController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.skill.create), (req, res, next) => skillController.store(req, res, next));
router.put('/:id', authenticateToken, authorizeRoles('admin'), validate(schemas.skill.update), (req, res, next) => skillController.update(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => skillController.destroy(req, res, next));

module.exports = router;
