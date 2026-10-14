const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

class SessionRepository extends BaseRepository {
  constructor() {
    super('sessions');
  }

  async findAllWithDetails(options = {}) {
    const { where = {}, order = 's.date DESC', limit, offset, courseId } = options;
    let sql = `
      SELECT s.*, g.name as group_name, c.name as course_name, c.language, c.level,
             ms.name as submodule_name,
             u.first_name || ' ' || u.last_name as teacher_name
      FROM sessions s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN courses c ON g.course_id = c.id
      LEFT JOIN module_submodules ms ON ms.id = s.submodule_id
      LEFT JOIN teachers t ON s.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
    `;
    const params = [];

    const conditions = [];
    if (courseId) {
      conditions.push('c.id = ?');
      params.push(courseId);
    }
    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        conditions.push(`s.${key} = ?`);
        params.push(where[key]);
      });
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY ${order}`;

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
      if (offset) {
        sql += ` OFFSET ?`;
        params.push(offset);
      }
    }

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async findByIdWithDetails(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, g.name as group_name, c.name as course_name, c.language, c.level,
               ms.name as submodule_name,
               u.first_name || ' ' || u.last_name as teacher_name
        FROM sessions s
        LEFT JOIN groups g ON s.group_id = g.id
        LEFT JOIN courses c ON g.course_id = c.id
        LEFT JOIN module_submodules ms ON ms.id = s.submodule_id
        LEFT JOIN teachers t ON s.teacher_id = t.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE s.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async findByGroup(groupId) {
    return this.findAll({ where: { group_id: groupId } });
  }

  async findByDate(date) {
    return this.findAll({ where: { date } });
  }
}

module.exports = new SessionRepository();
