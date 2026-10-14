const BaseService = require('./BaseService');
const sessionRepository = require('../repositories/SessionRepository');
const { get } = require('../utils/dbHelpers');
const AppError = require('../errors/AppError');

class SessionService extends BaseService {
  constructor() {
    super(sessionRepository);
  }

  async findAllWithDetails(options = {}) {
    const { page = 1, limit = 10, status, groupId, date, courseId } = options;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (groupId) where.group_id = groupId;
    if (date) where.date = date;

    const sessions = await this.repository.findAllWithDetails({ where, limit, offset, courseId });

    return {
      data: sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: sessions.length,
        totalPages: Math.ceil(sessions.length / limit)
      }
    };
  }

  async findByIdWithDetails(id) {
    const session = await this.repository.findByIdWithDetails(id);
    if (!session) {
      throw new AppError('Session not found', 404, 'NOT_FOUND');
    }
    return session;
  }

  async findByGroup(groupId) {
    return await this.repository.findByGroup(groupId);
  }

  async findByDate(date) {
    return await this.repository.findByDate(date);
  }

  /**
   * Verify links and normalise the date before writing, so a bad id gets a
   * clean 404 and any date shape ends up stored as YYYY-MM-DD.
   */
  async create(data) {
    const normalised = await SessionService.normalise({ ...data });
    await SessionService.assertLinks(normalised);
    await SessionService.assertNoConflict(normalised, null);
    return await this.repository.create(normalised);
  }

  async update(id, data) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Session not found', 404, 'NOT_FOUND');
    }
    const normalised = await SessionService.normalise({ ...data });
    await SessionService.assertLinks(normalised);
    await SessionService.assertNoConflict(normalised, Number(id), existing);
    return await this.repository.update(id, normalised);
  }

  /**
   * A teacher cannot be in two places at once, and neither can a room: refuse
   * a session that overlaps another one on the same date with the same
   * teacher or the same room. Completed/cancelled sessions are history and
   * never block. Times are 'HH:MM' strings, comparable lexicographically.
   */
  static async assertNoConflict(data, ignoreId, existing = null) {
    const { all } = require('../utils/dbHelpers');
    const merged = { ...(existing || {}), ...data };
    // Repository rows are snake_case, request bodies camelCase: accept both.
    const date = merged.date;
    const start = merged.startTime ?? merged.start_time;
    const end = merged.endTime ?? merged.end_time;
    const teacherId = merged.teacherId ?? merged.teacher_id ?? null;
    const room = String(merged.room ?? '').trim().toLowerCase();
    if (!date || !start || !end) return;
    if (end <= start) {
      throw new AppError(
        `Invalid session hours: end (${end}) must be after start (${start}).`,
        422,
        'INVALID_TIME_RANGE'
      );
    }
    const sameDay = await all(
      `SELECT id, start_time, end_time, teacher_id, room FROM sessions
       WHERE date = ? AND status NOT IN ('completed', 'cancelled')
       ${ignoreId ? 'AND id != ?' : ''}`,
      ignoreId ? [date, ignoreId] : [date]
    );
    const clash = sameDay.find((row) =>
      row.start_time < end && start < row.end_time &&
      ((teacherId != null && row.teacher_id != null && Number(row.teacher_id) === Number(teacherId)) ||
       (room !== '' && String(row.room ?? '').trim().toLowerCase() === room))
    );
    if (clash) {
      const what = (teacherId != null && clash.teacher_id != null &&
        Number(clash.teacher_id) === Number(teacherId)) ? 'teacher' : 'room';
      throw new AppError(
        `Planning conflict: this ${what} is already booked on ${date} ` +
        `from ${clash.start_time} to ${clash.end_time} (session #${clash.id}).`,
        409,
        'SESSION_CONFLICT'
      );
    }
  }

  /**
   * Refuse the deletion of a session that already has attendance recorded
   * instead of leaking a raw SQLITE_CONSTRAINT. Sessions without attendance
   * delete cleanly.
   */
  async delete(id) {
    const { get } = require('../utils/dbHelpers');
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Session not found', 404, 'NOT_FOUND');
    }
    const attendance = await get('SELECT COUNT(*) AS n FROM attendance WHERE session_id = ?', [Number(id)]);
    if (attendance.n > 0) {
      throw new AppError(
        `Cannot delete this session: ${attendance.n} attendance record(s) reference it.`,
        409,
        'SESSION_HAS_ATTENDANCE'
      );
    }
    return await this.repository.delete(id);
  }

  /**
   * Accept a Date, a millisecond timestamp (number or numeric string) or an
   * ISO string, and always store YYYY-MM-DD. Rejects anything unparseable
   * instead of persisting garbage like '[object Object]'.
   */
  static normalise(data) {
    if (data.date === undefined || data.date === null || data.date === '') {
      return data;
    }
    let millis;
    if (data.date instanceof Date) {
      millis = data.date.getTime();
    } else if (typeof data.date === 'number') {
      millis = data.date;
    } else if (typeof data.date === 'string' && /^-?\d+(\.0)?$/.test(data.date.trim())) {
      millis = parseFloat(data.date);
    } else {
      const parsed = new Date(data.date);
      if (Number.isNaN(parsed.getTime())) {
        throw new AppError(`Invalid date: ${data.date}`, 400, 'INVALID_DATE');
      }
      millis = parsed.getTime();
    }
    if (!Number.isFinite(millis)) {
      throw new AppError(`Invalid date: ${data.date}`, 400, 'INVALID_DATE');
    }
    data.date = new Date(millis).toISOString().slice(0, 10);
    return data;
  }

  static async assertLinks(data) {
    if (data.groupId !== undefined && data.groupId !== null) {
      const group = await get('SELECT id FROM groups WHERE id = ?', [data.groupId]);
      if (!group) {
        throw new AppError(`Unknown group: ${data.groupId}`, 404, 'GROUP_NOT_FOUND');
      }
    }
    if (data.teacherId !== undefined && data.teacherId !== null) {
      const teacher = await get('SELECT id FROM teachers WHERE id = ?', [data.teacherId]);
      if (!teacher) {
        throw new AppError(`Unknown teacher: ${data.teacherId}`, 404, 'TEACHER_NOT_FOUND');
      }
    }
    if (data.submoduleId !== undefined && data.submoduleId !== null && data.submoduleId !== '') {
      const submodule = await get('SELECT id FROM module_submodules WHERE id = ?', [data.submoduleId]);
      if (!submodule) {
        throw new AppError(`Unknown submodule: ${data.submoduleId}`, 404, 'SUBMODULE_NOT_FOUND');
      }
    }
  }
}

module.exports = new SessionService();
