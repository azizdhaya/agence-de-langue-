const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

class GroupRepository extends BaseRepository {
  constructor() {
    super('groups');
  }

  async findAllWithDetails(options = {}) {
    const { where = {}, order = 'g.created_at DESC', limit, offset, search } = options;
    let sql = `
      SELECT g.*, c.name as course_name, c.language, c.level,
             u.first_name || ' ' || u.last_name as teacher_name,
             COUNT(e.student_id) as enrolled_students
      FROM groups g
      LEFT JOIN courses c ON g.course_id = c.id
      LEFT JOIN teachers t ON g.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN enrollments e ON g.id = e.group_id AND e.status = 'active'
    `;
    const params = [];

    const conditions = [];
    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`g.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(g.name LIKE ? OR c.name LIKE ?)`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` GROUP BY g.id ORDER BY ${order}`;

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
        SELECT g.*, c.name as course_name, c.language, c.level,
               u.first_name || ' ' || u.last_name as teacher_name,
               COUNT(e.student_id) as enrolled_students
        FROM groups g
        LEFT JOIN courses c ON g.course_id = c.id
        LEFT JOIN teachers t ON g.teacher_id = t.id
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN enrollments e ON g.id = e.group_id AND e.status = 'active'
        WHERE g.id = ?
        GROUP BY g.id
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async countWithFilters(where = {}, search) {
    let sql = `SELECT COUNT(*) as count FROM groups g LEFT JOIN courses c ON g.course_id = c.id`;
    const params = [];
    const conditions = [];

    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`g.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(g.name LIKE ? OR c.name LIKE ?)`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }
}

module.exports = new GroupRepository();
