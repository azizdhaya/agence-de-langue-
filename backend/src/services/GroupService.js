const BaseService = require('./BaseService');
const groupRepository = require('../repositories/GroupRepository');
const { get } = require('../utils/dbHelpers');
const AppError = require('../errors/AppError');

class GroupService extends BaseService {
  constructor() {
    super(groupRepository);
  }

  async findAllWithDetails(options = {}) {
    const { page = 1, limit = 10, search, status } = options;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;

    const [groups, total] = await Promise.all([
      this.repository.findAllWithDetails({ where, limit, offset, search }),
      this.repository.countWithFilters(where, search)
    ]);

    return {
      data: groups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findByIdWithDetails(id) {
    const group = await this.repository.findByIdWithDetails(id);
    if (!group) {
      throw new AppError('Group not found', 404, 'NOT_FOUND');
    }
    return group;
  }

  /**
   * Verify the linked course and teacher exist before writing, so a bad id
   * gets a clean 404 instead of a raw FK 500.
   */
  async create(data) {
    await GroupService.assertLinks(data);
    return await this.repository.create(data);
  }

  async update(id, data) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Group not found', 404, 'NOT_FOUND');
    }
    await GroupService.assertLinks(data);
    return await this.repository.update(id, data);
  }

  /**
   * Delete a group in one step: its members are automatically unenrolled from
   * the course too (no per-candidate round-trip), then the group is removed.
   * Refused with an explicit 409 — nothing is deleted — when pedagogical
   * history exists: sessions attached to the group.
   */
  async delete(id) {
    const { get, all, run } = require('../utils/dbHelpers');
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Group not found', 404, 'NOT_FOUND');
    }
    const [members, sessions] = await Promise.all([
      all(`SELECT e.id FROM enrollments e WHERE e.group_id = ?`, [Number(id)]),
      get('SELECT COUNT(*) AS n FROM sessions WHERE group_id = ?', [Number(id)])
    ]);
    if (sessions.n > 0) {
      throw new AppError(
        `Cannot delete this group: ${sessions.n} séance(s). Supprimez d'abord ces séances.`,
        409,
        'GROUP_IN_USE'
      );
    }
    for (const member of members) {
      await run('DELETE FROM enrollments WHERE id = ?', [member.id]);
    }
    return await this.repository.delete(id);
  }

  static async assertLinks(data) {
    if (data.courseId !== undefined && data.courseId !== null) {
      const course = await get('SELECT id FROM courses WHERE id = ?', [data.courseId]);
      if (!course) {
        throw new AppError(`Unknown course: ${data.courseId}`, 404, 'COURSE_NOT_FOUND');
      }
    }
    if (data.teacherId !== undefined && data.teacherId !== null) {
      const teacher = await get('SELECT id FROM teachers WHERE id = ?', [data.teacherId]);
      if (!teacher) {
        throw new AppError(`Unknown teacher: ${data.teacherId}`, 404, 'TEACHER_NOT_FOUND');
      }
    }
  }
}

module.exports = new GroupService();
