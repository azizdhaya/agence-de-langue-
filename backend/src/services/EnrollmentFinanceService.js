const { get, all, run, transaction } = require('../utils/dbHelpers');
const { toMillimes, sumMillimes } = require('../utils/money');
const AppError = require('../errors/AppError');
const { StudentLanguageService } = require('./StudentLanguageService');

const LEDGER_SELECT = `
    SELECT
      em.id AS enrollment_module_id, em.enrollment_id, em.module_id,
      em.discount_percent, em.status AS module_status, em.registered_at, em.settled_at,
      cm.name AS module_name, cm.position AS module_position, cm.status AS module_catalogue_status,
      e.course_id, c.name AS course_name,
      es.id AS enrollment_submodule_id, es.submodule_id, es.price_millimes,
      es.discount_millimes, es.amount_paid_millimes, es.balance_millimes,
      es.status AS submodule_status, es.due_date,
      ms.name AS submodule_name, ms.position AS submodule_position
    FROM enrollment_modules em
    JOIN enrollments e ON e.id = em.enrollment_id
    JOIN courses c ON c.id = e.course_id
    JOIN course_modules cm ON cm.id = em.module_id
    LEFT JOIN enrollment_submodules es ON es.enrollment_module_id = em.id
    LEFT JOIN module_submodules ms ON ms.id = es.submodule_id`;

/**
 * Bridges the catalogue and what a student owes.
 *
 * Registration snapshots one charge per submodule into `enrollment_submodules`
 * (price copied from the catalogue or overridden for that enrolment), grouped
 * under an `enrollment_modules` row. Balances are always read back with the
 * ledger queries: there is one source of truth (the charges and, from P2, the
 * payment allocations), never a duplicated total.
 */
class EnrollmentFinanceService {
  /**
   * Register a student to one or more modules of a course, creating the
   * submodule charges. Idempotent: a module already registered is left as is,
   * and an existing charge keeps its price snapshot.
   *
   * @param {number} enrollmentId the student's course enrolment
   * @param {number} courseId the course the modules belong to
   * @param {number[]} moduleIds modules to register
   * @param {Object<string, number>} priceOverrides optional per-submodule price
   * @returns {Promise<Array<{moduleId:number, created:boolean, charges:number}>>}
   */
  async registerModules(enrollmentId, courseId, moduleIds = [], priceOverrides = {}) {
    const ids = [...new Set((moduleIds || [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0))];
    if (ids.length === 0) return [];

    return await transaction(async () => {
      const results = [];
      for (const moduleId of ids) {
        const module = await get(
          'SELECT * FROM course_modules WHERE id = ? AND course_id = ?',
          [moduleId, Number(courseId)]
        );
        if (!module) {
          throw new AppError(`Unknown module: ${moduleId}`, 404, 'MODULE_NOT_FOUND');
        }

        const submodules = await all(
          `SELECT * FROM module_submodules
           WHERE module_id = ? AND status = 'active'
           ORDER BY position ASC, id ASC`,
          [moduleId]
        );
        if (submodules.length === 0) {
          throw new AppError(
            `Module "${module.name}" has no active submodule to charge.`,
            422,
            'MODULE_HAS_NO_SUBMODULES'
          );
        }

        const existing = await get(
          'SELECT * FROM enrollment_modules WHERE enrollment_id = ? AND module_id = ?',
          [enrollmentId, moduleId]
        );

        let enrollmentModuleId;
        if (existing) {
          enrollmentModuleId = existing.id;
        } else {
          const inserted = await run(
            `INSERT INTO enrollment_modules (enrollment_id, module_id, discount_percent, status)
             VALUES (?, ?, 0, 'active')`,
            [enrollmentId, moduleId]
          );
          enrollmentModuleId = inserted.lastID;
        }

        let created = 0;
        for (const sub of submodules) {
          const override = priceOverrides[sub.id] ?? priceOverrides[String(sub.id)];
          const price = override !== undefined && override !== null && override !== ''
            ? toMillimes(override)
            : Number(sub.price_millimes) || 0;
          // A submodule is billed before it starts: the charge is due the day it
          // is registered (the settlement phase owns the real due-date policy).
          const result = await run(
            `INSERT OR IGNORE INTO enrollment_submodules
               (enrollment_module_id, submodule_id, price_millimes, discount_millimes,
                amount_paid_millimes, balance_millimes, status, due_date)
             VALUES (?, ?, ?, 0, 0, ?, 'unpaid', date('now'))`,
            [enrollmentModuleId, sub.id, price, price]
          );
          created += result.changes;
        }

        results.push({ moduleId, created: !existing, charges: created });
      }
      return results;
    });
  }

  /**
   * Financial position of a student: enrolled modules, their submodule charges
   * and the totals rolled up per module, per course and globally. No payment is
   * modelled yet (P2), so `amount_paid_millimes` is 0 and the balance equals the
   * charge; the shape is final so the payment phase only fills it in.
   */
  async ledgerForStudent(rawStudentId) {
    const studentId = await StudentLanguageService.resolveStudentId(rawStudentId);
    const rows = await all(
      `${LEDGER_SELECT}
       WHERE e.student_id = ?
       ORDER BY e.id ASC, cm.position ASC, em.id ASC, ms.position ASC, es.id ASC`,
      [studentId]
    );
    const student = await get(
      `SELECT s.id, u.first_name, u.last_name
       FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [studentId]
    );
    return { student: student || { id: studentId }, ...EnrollmentFinanceService.group(rows) };
  }

  /** Same read model, for one enrolment. */
  async ledgerForEnrollment(enrollmentId) {
    const enrollment = await get('SELECT id FROM enrollments WHERE id = ?', [Number(enrollmentId)]);
    if (!enrollment) {
      throw new AppError('Enrollment not found', 404, 'NOT_FOUND');
    }
    const rows = await all(
      `${LEDGER_SELECT}
       WHERE em.enrollment_id = ?
       ORDER BY cm.position ASC, em.id ASC, ms.position ASC, es.id ASC`,
      [enrollment.id]
    );
    return EnrollmentFinanceService.group(rows);
  }

  static amountTotals(lines) {
    return {
      price_millimes: sumMillimes(lines.map((line) => line.price_millimes)),
      discount_millimes: sumMillimes(lines.map((line) => line.discount_millimes)),
      paid_millimes: sumMillimes(lines.map((line) => line.amount_paid_millimes)),
      balance_millimes: sumMillimes(lines.map((line) => line.balance_millimes))
    };
  }

  /** Group flat ledger rows into courses → modules → submodules with totals. */
  static group(rows) {
    const enrollments = new Map();

    for (const row of rows) {
      if (!enrollments.has(row.enrollment_id)) {
        const enrollment = {
          enrollment_id: row.enrollment_id,
          course_id: row.course_id,
          course_name: row.course_name,
          modules: [],
          _modules: new Map()
        };
        enrollments.set(row.enrollment_id, enrollment);
      }
      const enrollment = enrollments.get(row.enrollment_id);

      if (!enrollment._modules.has(row.enrollment_module_id)) {
        const module = {
          enrollment_module_id: row.enrollment_module_id,
          module_id: row.module_id,
          module_name: row.module_name,
          position: row.module_position,
          discount_percent: row.discount_percent,
          status: row.module_status,
          registered_at: row.registered_at,
          settled_at: row.settled_at,
          submodules: []
        };
        enrollment._modules.set(row.enrollment_module_id, module);
        enrollment.modules.push(module);
      }
      const module = enrollment._modules.get(row.enrollment_module_id);

      if (row.enrollment_submodule_id != null) {
        module.submodules.push({
          enrollment_submodule_id: row.enrollment_submodule_id,
          submodule_id: row.submodule_id,
          name: row.submodule_name,
          position: row.submodule_position,
          price_millimes: row.price_millimes,
          discount_millimes: row.discount_millimes,
          amount_paid_millimes: row.amount_paid_millimes,
          balance_millimes: row.balance_millimes,
          status: row.submodule_status,
          due_date: row.due_date
        });
      }
    }

    const enrollmentList = [...enrollments.values()];
    const allLines = [];
    for (const enrollment of enrollmentList) {
      for (const module of enrollment.modules) {
        module.totals = EnrollmentFinanceService.amountTotals(module.submodules);
        module.submodule_count = module.submodules.length;
        module.paid = module.submodules.length > 0 &&
          module.submodules.every((sub) => sub.status === 'paid');
        allLines.push(...module.submodules);
      }
      delete enrollment._modules;
      enrollment.totals = EnrollmentFinanceService.amountTotals(
        enrollment.modules.flatMap((module) => module.submodules)
      );
    }

    return {
      enrollments: enrollmentList,
      totals: EnrollmentFinanceService.amountTotals(allLines)
    };
  }
}

module.exports = new EnrollmentFinanceService();
