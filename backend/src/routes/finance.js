const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const financeController = require('../controllers/FinanceController');

// Ledger read model (what a student owes). Staff only: a student sees their own
// position through the student endpoints, not this admin view.
router.get('/students/:studentId/ledger', authenticateToken, authorizeRoles('admin', 'teacher'),
  (req, res, next) => financeController.studentLedger(req, res, next));
router.get('/enrollments/:enrollmentId/ledger', authenticateToken, authorizeRoles('admin', 'teacher'),
  (req, res, next) => financeController.enrollmentLedger(req, res, next));

// Payments: staff can read a student's history, only admins record or void one.
router.get('/students/:studentId/payments', authenticateToken, authorizeRoles('admin', 'teacher'),
  (req, res, next) => financeController.listPayments(req, res, next));
router.post('/students/:studentId/payments', authenticateToken, authorizeRoles('admin'),
  validate(schemas.payment.create), (req, res, next) => financeController.recordPayment(req, res, next));
router.get('/payments/:id', authenticateToken, authorizeRoles('admin', 'teacher'),
  (req, res, next) => financeController.showPayment(req, res, next));
router.delete('/payments/:id', authenticateToken, authorizeRoles('admin'),
  (req, res, next) => financeController.voidPayment(req, res, next));

module.exports = router;
