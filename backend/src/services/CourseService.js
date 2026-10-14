const BaseService = require('./BaseService');
const courseRepository = require('../repositories/CourseRepository');
const levelRepository = require('../repositories/LevelRepository');
const studentLanguageService = require('./StudentLanguageService');
const enrollmentFinanceService = require('./EnrollmentFinanceService');
const { get, all, run } = require('../utils/dbHelpers');
const AppError = require('../errors/AppError');

class CourseService extends BaseService {
  constructor() {
    super(courseRepository);
  }

  async findAllWithDetails(options = {}) {
    const { page = 1, limit = 10, search, status, language, level, languageId, levelId } = options;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (language) where.language = language;
    if (level) where.level = level;
    if (languageId) where.language_id = languageId;
    if (levelId) where.level_id = levelId;

    const [courses, total] = await Promise.all([
      this.repository.findAllWithDetails({ where, limit, offset, search }),
      this.repository.countWithFilters(where, search)
    ]);

    return {
      data: courses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findByIdWithDetails(id) {
    const course = await this.repository.findByIdWithDetails(id);
    if (!course) {
      throw new AppError('Course not found', 404, 'NOT_FOUND');
    }
    return course;
  }

  /**
   * Resolve CEFR linkage on write: a levelCode becomes the level_id FK.
   * The legacy TEXT columns are still written so old clients keep working.
   */
  async create(data) {
    await CourseService.assertLinks(data);
    await CourseService.assertDates(data, null);
    return await this.repository.create(await CourseService.resolveLevelLink(data));
  }

  async update(id, data) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Course not found', 404, 'NOT_FOUND');
    }
    await CourseService.assertLinks(data);
    await CourseService.assertDates(data, existing);
    return await this.repository.update(id, await CourseService.resolveLevelLink(data));
  }

  /**
   * Unknown foreign keys get a clean 404 instead of a raw FK 500.
   */
  static async assertLinks(data) {
    if (data.teacherId !== undefined && data.teacherId !== null && data.teacherId !== '') {
      const teacher = await get('SELECT id FROM teachers WHERE id = ?', [Number(data.teacherId)]);
      if (!teacher) {
        throw new AppError(`Unknown teacher: ${data.teacherId}`, 404, 'TEACHER_NOT_FOUND');
      }
    }
    if (data.languageId !== undefined && data.languageId !== null && data.languageId !== '') {
      const language = await get('SELECT id FROM languages WHERE id = ?', [Number(data.languageId)]);
      if (!language) {
        throw new AppError(`Unknown language: ${data.languageId}`, 404, 'LANGUAGE_NOT_FOUND');
      }
    }
    if (data.levelId !== undefined && data.levelId !== null && data.levelId !== '') {
      const level = await get('SELECT id FROM levels WHERE id = ?', [Number(data.levelId)]);
      if (!level) {
        throw new AppError(`Unknown level: ${data.levelId}`, 404, 'LEVEL_NOT_FOUND');
      }
    }
  }

  /**
   * The end date must not precede the start date. On update, an omitted side
   * is read from the stored row so partial updates stay coherent too.
   */
  static async assertDates(data, existing) {
    const toDay = (value) => {
      if (value === undefined || value === null || value === '') return '';
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value).slice(0, 10);
    };
    const start = toDay(data.startDate) ||
      (existing ? toDay(existing.startDate ?? existing.start_date) : '');
    const end = toDay(data.endDate) ||
      (existing ? toDay(existing.endDate ?? existing.end_date) : '');
    if (start && end && end < start) {
      throw new AppError(
        `Invalid dates: the end date (${end}) precedes the start date (${start}).`,
        422,
        'INVALID_DATE_RANGE'
      );
    }
  }

  /**
   * Delete a course in one step: its clean enrolments are automatically
   * removed too (no per-candidate round-trip). Refused with an explicit
   * 409 — nothing is deleted — when groups still exist (delete them first:
   * they are one-click deletable themselves).
   */
  async delete(id) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Course not found', 404, 'NOT_FOUND');
    }
    const members = await all(
      `SELECT e.id, u.first_name, u.last_name FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       WHERE e.course_id = ?`, [id]
    );
    const groups = await get('SELECT COUNT(*) AS c FROM groups WHERE course_id = ?', [id]);
    if (groups && groups.c > 0) {
      throw new AppError(
        `Cannot delete course "${existing.name}": ${groups.c} groupe(s) — supprimez-les d'abord.`,
        409,
        'COURSE_IN_USE'
      );
    }
    for (const member of members) {
      await run('DELETE FROM enrollments WHERE id = ?', [member.id]);
    }
    return await this.repository.delete(id);
  }

  static async resolveLevelLink(data) {
    const out = { ...data };
    if (data.levelCode !== undefined) {
      if (data.levelCode === null || data.levelCode === '') {
        out.level_id = null;
      } else {
        const level = await levelRepository.findByCode(data.levelCode);
        if (!level) {
          throw new AppError(`Unknown level: ${data.levelCode}`, 404, 'LEVEL_NOT_FOUND');
        }
        out.level_id = level.id;
      }
      delete out.levelCode;
    }
    return out;
  }

  /**
   * Enrol a student in a course, optionally straight into one of its groups.
   *
   * When the course carries a CEFR level and the student's level in that
   * language does not match, enrolment is refused with a 409 carrying the
   * coherence verdict — unless the caller passes { confirmed: true }, which is
   * the admin's explicit override (§7.4). Courses without a CEFR level and
   * students without an assessed level enrol freely.
   *
   * The student id follows the UI convention (users-table id first): every
   * picker carries user ids, so they are resolved before touching enrollments.
   */
  async enrollStudent(studentId, courseId, confirmed = false, groupId = null, options = {}) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new AppError('Course not found', 404, 'NOT_FOUND');
    }
    const { StudentLanguageService } = require('./StudentLanguageService');
    const resolvedId = await StudentLanguageService.resolveStudentId(studentId);
    const moduleIds = Array.isArray(options.moduleIds) ? options.moduleIds : [];
    const priceOverrides = options.priceOverrides && typeof options.priceOverrides === 'object'
      ? options.priceOverrides
      : {};

    if (groupId !== undefined && groupId !== null && groupId !== '') {
      await this.assertGroupForCourse(Number(groupId), Number(courseId), null);
    }

    const verdict = await studentLanguageService.checkEnrollment(resolvedId, Number(courseId));
    if (verdict.requiresConfirmation && !confirmed) {
      throw new AppError(
        `Enrolment needs confirmation: ${verdict.reason}`,
        409,
        'LEVEL_MISMATCH'
      );
    }

    // Resolve the course enrolment first (create it, or reuse the one that
    // already exists so modules can be added to an existing student), then
    // snapshot the module charges. Both live in the same request.
    let enrollmentId;
    let moved = false;
    try {
      const result = await run(
        'INSERT INTO enrollments (student_id, course_id, group_id) VALUES (?, ?, ?)',
        [resolvedId, Number(courseId), groupId ? Number(groupId) : null]
      );
      enrollmentId = result.lastID;
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        // Already enrolled in the course: assigning a group moves the
        // enrolment instead of failing, so the group picker stays usable on
        // students enrolled beforehand.
        if (groupId) {
          await this.assertGroupForCourse(Number(groupId), Number(courseId), resolvedId);
          await run(
            'UPDATE enrollments SET group_id = ? WHERE student_id = ? AND course_id = ?',
            [Number(groupId), resolvedId, Number(courseId)]
          );
          moved = true;
        } else if (moduleIds.length === 0) {
          // Nothing to change and nothing to add: keep the historical refusal.
          throw new AppError('Student already enrolled in this course', 400, 'ALREADY_ENROLLED');
        }
        const enrollment = await get(
          'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
          [resolvedId, Number(courseId)]
        );
        enrollmentId = enrollment.id;
      } else {
        throw error;
      }
    }

    const charges = await enrollmentFinanceService.registerModules(
      enrollmentId, Number(courseId), moduleIds, priceOverrides
    );

    return {
      enrollmentId,
      coherence: verdict,
      charges,
      ...(moved ? { moved: true } : {})
    };
  }

  /**
   * Guard a group assignment: the group exists, belongs to the course, is
   * active, and still has a free seat for a newcomer (`ignoreStudentId` is
   * the enrolment being moved, not a newcomer).
   */
  async assertGroupForCourse(groupId, courseId, ignoreStudentId = null) {
    const group = await get('SELECT * FROM groups WHERE id = ?', [groupId]);
    if (!group) {
      throw new AppError('Group not found', 404, 'NOT_FOUND');
    }
    if (Number(group.course_id) !== Number(courseId)) {
      throw new AppError(
        'This group does not belong to the selected course.',
        422,
        'GROUP_COURSE_MISMATCH'
      );
    }
    if (group.status !== 'active') {
      throw new AppError(
        `Students cannot join a ${group.status} group.`,
        409,
        'GROUP_INACTIVE'
      );
    }
    if (group.max_students !== null && group.max_students !== undefined) {
      const occupied = await get(
        `SELECT COUNT(*) AS n FROM enrollments
         WHERE group_id = ? AND status = 'active' AND student_id != COALESCE(?, -1)`,
        [groupId, ignoreStudentId]
      );
      if (occupied.n >= Number(group.max_students)) {
        throw new AppError(
          `Group ${group.name} is full (${group.max_students} seats).`,
          409,
          'GROUP_FULL'
        );
      }
    }
  }

  /** Students actively enrolled in a group, with their course enrolment. */
  async groupStudents(groupId) {
    const group = await get('SELECT * FROM groups WHERE id = ?', [Number(groupId)]);
    if (!group) {
      throw new AppError('Group not found', 404, 'NOT_FOUND');
    }
    return await all(
      `SELECT u.id as user_id, s.id as student_id, u.first_name, u.last_name, u.email, u.phone,
              e.id as enrollment_id, e.enrollment_date, e.status as enrollment_status
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       WHERE e.group_id = ? AND e.status = 'active'
       ORDER BY u.last_name ASC, u.first_name ASC`,
      [Number(groupId)]
    );
  }

  /**
   * Remove a course enrolment entirely (not just its group link).
   */
  async unenroll(enrollmentId) {
    const enrollment = await get(
      'SELECT * FROM enrollments WHERE id = ?', [Number(enrollmentId)]
    );
    if (!enrollment) {
      throw new AppError('Enrollment not found', 404, 'NOT_FOUND');
    }
    await run('DELETE FROM enrollments WHERE id = ?', [enrollment.id]);
    return { removed: true };
  }

  /**
   * Take a student out of a group AND out of the course in one step: the
   * enrolment itself is deleted, so the course headcount drops too.
   */
  async removeFromGroup(groupId, studentId) {
    const group = await get('SELECT * FROM groups WHERE id = ?', [Number(groupId)]);
    if (!group) {
      throw new AppError('Group not found', 404, 'NOT_FOUND');
    }
    const { StudentLanguageService } = require('./StudentLanguageService');
    const resolvedId = await StudentLanguageService.resolveStudentId(studentId);
    const enrollment = await get(
      `SELECT * FROM enrollments
       WHERE group_id = ? AND student_id = ? AND status = 'active'`,
      [Number(groupId), resolvedId]
    );
    if (!enrollment) {
      throw new AppError('This student is not in the group.', 404, 'NOT_IN_GROUP');
    }
    await run('DELETE FROM enrollments WHERE id = ?', [enrollment.id]);
    return { removed: true, unenrolled: true };
  }

  /** Students actively enrolled in a course. */
  async findStudents(courseId) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new AppError('Course not found', 404, 'NOT_FOUND');
    }
    return await all(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, e.enrollment_date, e.status
       FROM users u
       JOIN students s ON u.id = s.user_id
       JOIN enrollments e ON s.id = e.student_id
       WHERE e.course_id = ?`,
      [courseId]
    );
  }
}

module.exports = new CourseService();
