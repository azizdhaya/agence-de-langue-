const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const moduleController = require('../controllers/ModuleController');

// Programme of a course: modules and their submodules. Reads are open to any
// authenticated user (the catalogue is shown on the course sheet); writes stay
// admin-only.
router.get('/courses/:courseId/modules', authenticateToken,
  (req, res, next) => moduleController.listByCourse(req, res, next));
router.post('/courses/:courseId/modules', authenticateToken, authorizeRoles('admin'),
  validate(schemas.module.create), (req, res, next) => moduleController.store(req, res, next));

router.get('/modules/:id', authenticateToken,
  (req, res, next) => moduleController.show(req, res, next));
router.put('/modules/:id', authenticateToken, authorizeRoles('admin'),
  validate(schemas.module.update), (req, res, next) => moduleController.update(req, res, next));
router.delete('/modules/:id', authenticateToken, authorizeRoles('admin'),
  (req, res, next) => moduleController.destroy(req, res, next));

router.get('/modules/:moduleId/submodules', authenticateToken,
  (req, res, next) => moduleController.listSubmodules(req, res, next));
router.post('/modules/:moduleId/submodules', authenticateToken, authorizeRoles('admin'),
  validate(schemas.submodule.create), (req, res, next) => moduleController.storeSubmodule(req, res, next));

router.put('/submodules/:id', authenticateToken, authorizeRoles('admin'),
  validate(schemas.submodule.update), (req, res, next) => moduleController.updateSubmodule(req, res, next));
router.delete('/submodules/:id', authenticateToken, authorizeRoles('admin'),
  (req, res, next) => moduleController.destroySubmodule(req, res, next));

module.exports = router;
