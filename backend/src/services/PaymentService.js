const { get, all, run, transaction } = require('../utils/dbHelpers');
const { distributeDiscount, sumMillimes } = require('../utils/money');
const AppError = require('../errors/AppError');
const { StudentLanguageService } = require('./StudentLanguageService');

const METHODS = ['cash', 'card', 'transfer', 'check', 'other'];

/**
 * Records money received and spreads it over the submodule charges.
 *
 * The `payment_allocations` rows are the single source of truth for what is
 * paid; the cache columns on `enrollment_submodules` (`amount_paid_millimes`,
 * `balance_millimes`, `status`) are always recomputed from them, inside the
 * same transaction as the write. A submodule is settled in full — there is no
 * partial balance on a submodule.
 *
 * Two ways to settle, both selectable in a single payment:
 *  - one submodule at its full remaining balance;
 *  - a whole module, applying an optional discount percent. The discount is
 *    only offered on a **clean** module (no submodule already paid) and is
 *    distributed across the module's submodules proportionally, with the
 *    rounding remainder on the last one so the totals stay exact.
 */
class PaymentService {
  static assertMethod(method) {
    if (!METHODS.includes(method)) {
      throw new AppError(
        `Invalid payment method: ${method}. Expected one of: ${METHODS.join(', ')}`,
        400,
        'INVALID_METHOD'
      );
    }
  }

  static normalizePercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return Math.min(100, num);
  }

  /**
   * Record a payment for a student.
   *
   * @param {number} rawStudentId user id (or students id) of the payer
   * @param {object} data { method, reference, note, paidAt, items }
   * @param {number|null} recordedBy the staff user id
   * @returns {Promise<object>} the stored payment with its allocations
   */
  async recordPayment(rawStudentId, data = {}, recordedBy = null) {
    const studentId = await StudentLanguageService.resolveStudentId(rawStudentId);
    const method = data.method || 'cash';
    PaymentService.assertMethod(method);

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      throw new AppError('No item to settle', 400, 'NO_ITEMS');
    }

    return await transaction(async () => {
      const allocations = [];

      for (const item of items) {
        if (item.enrollmentModuleId !== undefined && item.enrollmentModuleId !== null) {
          const moduleAllocations = await PaymentService.settleModule(
            studentId,
            item.enrollmentModuleId,
            item.discountPercent
          );
          allocations.push(...moduleAllocations);
        } else if (item.enrollmentSubmoduleId !== undefined && item.enrollmentSubmoduleId !== null) {
          allocations.push(await PaymentService.settleSubmodule(studentId, item.enrollmentSubmoduleId));
        } else {
          throw new AppError(
            'Each item needs an enrollmentModuleId or an enrollmentSubmoduleId',
            400,
            'INVALID_ITEM'
          );
        }
      }

      const seen = new Set();
      for (const allocation of allocations) {
        if (seen.has(allocation.enrollment_submodule_id)) {
          throw new AppError('A submodule cannot be settled twice in one payment', 400, 'DUPLICATE_ITEM');
        }
        seen.add(allocation.enrollment_submodule_id);
      }

      const total = sumMillimes(allocations.map((allocation) => allocation.amount_millimes));
      if (total <= 0) {
        throw new AppError('Nothing to pay', 409, 'NOTHING_TO_PAY');
      }

      const paidAt = data.paidAt ? new Date(data.paidAt).toISOString() : new Date().toISOString();
      const inserted = await run(
        `INSERT INTO payments (student_id, amount_millimes, method, reference, note, paid_at, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [studentId, total, method, data.reference ?? null, data.note ?? null, paidAt, recordedBy ?? null]
      );
      const paymentId = inserted.lastID;

      for (const allocation of allocations) {
        await run(
          `INSERT INTO payment_allocations (payment_id, enrollment_submodule_id, amount_millimes)
           VALUES (?, ?, ?)`,
          [paymentId, allocation.enrollment_submodule_id, allocation.amount_millimes]
        );
        await PaymentService.refreshSubmodule(allocation.enrollment_submodule_id);
      }

      return await this.getPayment(paymentId);
    });
  }

  /**
   * Prepare the allocations that settle a whole module. Applies the discount to
   * a clean module and writes the per-submodule discount share. Returns the
   * amounts to allocate; the caller inserts them and refreshes the caches.
   */
  static async settleModule(studentId, enrollmentModuleId, discountPercent) {
    const module = await PaymentService.loadModuleForStudent(studentId, enrollmentModuleId);
    const submodules = await all(
      'SELECT * FROM enrollment_submodules WHERE enrollment_module_id = ? ORDER BY id ASC',
      [module.id]
    );
    if (submodules.length === 0) {
      throw new AppError('This module has no charge', 409, 'MODULE_HAS_NO_CHARGES');
    }

    const unpaid = submodules.filter((sub) => sub.status !== 'paid' && Number(sub.balance_millimes) > 0);
    if (unpaid.length === 0) {
      throw new AppError('This module is already paid', 409, 'MODULE_ALREADY_PAID');
    }

    const percent = PaymentService.normalizePercent(discountPercent);
    const dirty = submodules.length !== unpaid.length;
    if (percent > 0 && dirty) {
      throw new AppError(
        'A whole-module discount is only available when no submodule is already paid',
        409,
        'MODULE_NOT_CLEAN'
      );
    }

    const prices = unpaid.map((sub) => Number(sub.price_millimes));
    const discounts = percent > 0 ? distributeDiscount(prices, percent) : unpaid.map(() => 0);

    const allocations = [];
    for (let i = 0; i < unpaid.length; i += 1) {
      const sub = unpaid[i];
      const discount = discounts[i];
      if (discount !== Number(sub.discount_millimes)) {
        await run('UPDATE enrollment_submodules SET discount_millimes = ? WHERE id = ?', [discount, sub.id]);
      }
      allocations.push({
        enrollment_submodule_id: sub.id,
        amount_millimes: Number(sub.price_millimes) - discount - Number(sub.amount_paid_millimes)
      });
    }

    // Audit the applied percent on the registration.
    await run('UPDATE enrollment_modules SET discount_percent = ? WHERE id = ?', [percent, module.id]);

    return allocations;
  }

  /** Prepare the allocation that settles one submodule in full. */
  static async settleSubmodule(studentId, enrollmentSubmoduleId) {
    const sub = await PaymentService.loadSubmoduleForStudent(studentId, enrollmentSubmoduleId);
    if (sub.status === 'paid' || Number(sub.balance_millimes) <= 0) {
      throw new AppError('This submodule is already paid', 409, 'ALREADY_PAID');
    }
    return {
      enrollment_submodule_id: sub.id,
      amount_millimes: Number(sub.balance_millimes)
    };
  }

  /** Recompute one charge's cache from its allocations, then its module state. */
  static async refreshSubmodule(enrollmentSubmoduleId) {
    const sub = await get('SELECT * FROM enrollment_submodules WHERE id = ?', [enrollmentSubmoduleId]);
    if (!sub) return;

    const paidRow = await get(
      'SELECT COALESCE(SUM(amount_millimes), 0) AS paid FROM payment_allocations WHERE enrollment_submodule_id = ?',
      [enrollmentSubmoduleId]
    );
    const paid = Number(paidRow.paid) || 0;
    const due = Number(sub.price_millimes) - Number(sub.discount_millimes);
    const balance = Math.max(0, due - paid);
    const status = balance <= 0 ? 'paid' : 'unpaid';

    await run(
      `UPDATE enrollment_submodules
       SET amount_paid_millimes = ?, balance_millimes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [paid, balance, status, enrollmentSubmoduleId]
    );

    await PaymentService.refreshModule(sub.enrollment_module_id);
  }

  /** A module is "settled" once every one of its submodules is paid. */
  static async refreshModule(enrollmentModuleId) {
    const aggregate = await get(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid
       FROM enrollment_submodules WHERE enrollment_module_id = ?`,
      [enrollmentModuleId]
    );
    const allPaid = Number(aggregate.total) > 0 && Number(aggregate.paid) === Number(aggregate.total);
    await run(
      `UPDATE enrollment_modules
       SET settled_at = CASE WHEN ? = 1 THEN COALESCE(settled_at, CURRENT_TIMESTAMP) ELSE NULL END
       WHERE id = ?`,
      [allPaid ? 1 : 0, enrollmentModuleId]
    );
  }

  static async loadSubmoduleForStudent(studentId, enrollmentSubmoduleId) {
    const id = Number(enrollmentSubmoduleId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(`Invalid charge id: ${enrollmentSubmoduleId}`, 400, 'INVALID_ID');
    }
    const row = await get(
      `SELECT es.* FROM enrollment_submodules es
       JOIN enrollment_modules em ON em.id = es.enrollment_module_id
       JOIN enrollments e ON e.id = em.enrollment_id
       WHERE es.id = ? AND e.student_id = ?`,
      [id, studentId]
    );
    if (!row) throw new AppError('Charge not found', 404, 'NOT_FOUND');
    return row;
  }

  static async loadModuleForStudent(studentId, enrollmentModuleId) {
    const id = Number(enrollmentModuleId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(`Invalid module registration id: ${enrollmentModuleId}`, 400, 'INVALID_ID');
    }
    const row = await get(
      `SELECT em.* FROM enrollment_modules em
       JOIN enrollments e ON e.id = em.enrollment_id
       WHERE em.id = ? AND e.student_id = ?`,
      [id, studentId]
    );
    if (!row) throw new AppError('Module registration not found', 404, 'NOT_FOUND');
    return row;
  }

  /** One payment with its allocations and the staff member who recorded it. */
  async getPayment(id) {
    const payment = await get('SELECT * FROM payments WHERE id = ?', [Number(id)]);
    if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');

    const allocations = await all(
      `SELECT pa.id, pa.enrollment_submodule_id, pa.amount_millimes,
              es.enrollment_module_id, em.module_id, cm.course_id,
              cm.name AS module_name, ms.name AS submodule_name,
              c.name AS course_name
       FROM payment_allocations pa
       JOIN enrollment_submodules es ON es.id = pa.enrollment_submodule_id
       JOIN enrollment_modules em ON em.id = es.enrollment_module_id
       JOIN course_modules cm ON cm.id = em.module_id
       JOIN module_submodules ms ON ms.id = es.submodule_id
       LEFT JOIN courses c ON c.id = cm.course_id
       WHERE pa.payment_id = ?
       ORDER BY pa.id ASC`,
      [payment.id]
    );

    const student = await get(
      `SELECT u.first_name, u.last_name, u.email
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
      [payment.student_id]
    );

    const recorder = payment.recorded_by
      ? await get('SELECT first_name, last_name FROM users WHERE id = ?', [payment.recorded_by])
      : null;

    return {
      ...payment,
      paid_millimes: payment.amount_millimes,
      student_name: student ? `${student.first_name} ${student.last_name}` : null,
      student_email: student ? student.email : null,
      allocations,
      recorded_by_name: recorder ? `${recorder.first_name} ${recorder.last_name}` : null
    };
  }

  /** Payments of a student, newest first. */
  async listPayments(rawStudentId) {
    const studentId = await StudentLanguageService.resolveStudentId(rawStudentId);
    const rows = await all(
      'SELECT id FROM payments WHERE student_id = ? ORDER BY paid_at DESC, id DESC',
      [studentId]
    );
    const payments = [];
    for (const row of rows) {
      payments.push(await this.getPayment(row.id));
    }
    return payments;
  }

  /**
   * Void a payment: delete it and its allocations, reverse the discount it
   * applied and recompute the affected charges, so a mistaken entry no longer
   * leaves a false balance.
   */
  async voidPayment(id) {
    const payment = await get('SELECT * FROM payments WHERE id = ?', [Number(id)]);
    if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');

    const allocations = await all(
      `SELECT pa.enrollment_submodule_id, es.enrollment_module_id
       FROM payment_allocations pa
       JOIN enrollment_submodules es ON es.id = pa.enrollment_submodule_id
       WHERE pa.payment_id = ?`,
      [payment.id]
    );

    return await transaction(async () => {
      await run('DELETE FROM payments WHERE id = ?', [payment.id]);

      // The discount was granted by this settlement: undo it before refreshing.
      for (const allocation of allocations) {
        await run('UPDATE enrollment_submodules SET discount_millimes = 0 WHERE id = ?', [
          allocation.enrollment_submodule_id
        ]);
        await PaymentService.refreshSubmodule(allocation.enrollment_submodule_id);
      }

      const moduleIds = [...new Set(allocations.map((a) => a.enrollment_module_id))];
      for (const moduleId of moduleIds) {
        await run('UPDATE enrollment_modules SET discount_percent = 0 WHERE id = ?', [moduleId]);
        await PaymentService.refreshModule(moduleId);
      }

      return { deleted: true, id: payment.id };
    });
  }
}

module.exports = new PaymentService();
