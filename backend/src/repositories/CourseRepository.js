const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

class CourseRepository extends BaseRepository {
  constructor() {
    super('courses');
  }

  async findAllWithDetails(options = {}) {
    const { where = {}, order = 'c.created_at DESC', limit, offset, search } = options;
    let sql = `
      SELECT c.*, u.first_name || ' ' || u.last_name as teacher_name,
             lang.code as language_code, lv.code as level_code,
             COUNT(e.student_id) as enrolled_students
      FROM courses c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN languages lang ON lang.id = c.language_id
      LEFT JOIN levels lv ON lv.id = c.level_id
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
    `;
    const params = [];

    const conditions = [];
    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`c.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(c.name LIKE ? OR c.language LIKE ?)`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` GROUP BY c.id ORDER BY ${order}`;

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
        SELECT c.*, u.first_name || ' ' || u.last_name as teacher_name, u.email as teacher_email,
               lang.code as language_code, lv.code as level_code,
               COUNT(e.student_id) as enrolled_students
        FROM courses c
        LEFT JOIN teachers t ON c.teacher_id = t.id
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN languages lang ON lang.id = c.language_id
        LEFT JOIN levels lv ON lv.id = c.level_id
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        WHERE c.id = ?
        GROUP BY c.id
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async countWithFilters(where = {}, search) {
    let sql = `SELECT COUNT(*) as count FROM courses c`;
    const params = [];
    const conditions = [];

    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`c.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(c.name LIKE ? OR c.language LIKE ?)`);
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

module.exports = new CourseRepository();
