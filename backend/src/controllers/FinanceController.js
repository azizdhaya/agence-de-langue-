const financeService = require('../services/EnrollmentFinanceService');
const paymentService = require('../services/PaymentService');

/**
 * Read model for what a student owes (per course, module and submodule) and the
 * write side that records payments against it.
 */
class FinanceController {
  async studentLedger(req, res, next) {
    try {
      const ledger = await financeService.ledgerForStudent(req.params.studentId);
      const payments = await paymentService.listPayments(req.params.studentId);
      res.json({ success: true, data: { ...ledger, payments } });
    } catch (error) {
      next(error);
    }
  }

  async enrollmentLedger(req, res, next) {
    try {
      const ledger = await financeService.ledgerForEnrollment(req.params.enrollmentId);
      res.json({ success: true, data: ledger });
    } catch (error) {
      next(error);
    }
  }

  async recordPayment(req, res, next) {
    try {
      const payment = await paymentService.recordPayment(req.params.studentId, req.body, req.user.id);
      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }

  async listPayments(req, res, next) {
    try {
      const payments = await paymentService.listPayments(req.params.studentId);
      res.json({ success: true, data: payments });
    } catch (error) {
      next(error);
    }
  }

  /** One payment with its allocations, for the printable receipt. */
  async showPayment(req, res, next) {
    try {
      const payment = await paymentService.getPayment(req.params.id);
      res.json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }

  async voidPayment(req, res, next) {
    try {
      const result = await paymentService.voidPayment(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FinanceController();
