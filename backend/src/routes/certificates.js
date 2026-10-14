const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const certificateController = require('../controllers/CertificateController');

router.get('/', authenticateToken, authorizeRoles('admin'), (req, res, next) => certificateController.index(req, res, next));
router.get('/verify/:code', (req, res, next) => certificateController.verify(req, res, next));
router.get('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => certificateController.show(req, res, next));
router.post('/', authenticateToken, authorizeRoles('admin'), validate(schemas.certificate.create), (req, res, next) => certificateController.store(req, res, next));
router.put('/:id', authenticateToken, authorizeRoles('admin'), validate(schemas.certificate.update), (req, res, next) => certificateController.update(req, res, next));
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => certificateController.destroy(req, res, next));

module.exports = router;
