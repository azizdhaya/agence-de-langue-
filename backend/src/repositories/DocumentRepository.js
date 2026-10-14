const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

class DocumentRepository extends BaseRepository {
  constructor() {
    super('documents');
  }

  async findAllWithDetails(options = {}) {
    const { where = {}, order = 'd.uploaded_at DESC', limit, offset, search } = options;
    let sql = `
      SELECT d.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email,
             s.user_id as student_user_id
      FROM documents d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN students s ON d.student_id = s.id
    `;
    const params = [];

    const conditions = [];
    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`d.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(d.name LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`);
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
        SELECT d.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email,
               s.user_id as student_user_id
        FROM documents d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN students s ON d.student_id = s.id
        WHERE d.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async findByUser(userId) {
    return this.findAll({ where: { user_id: userId } });
  }

  async findByStudent(studentId) {
    return this.findAll({ where: { student_id: studentId } });
  }

  async countWithFilters(where = {}, search) {
    let sql = `
      SELECT COUNT(*) as count
      FROM documents d
      JOIN users u ON d.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`d.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(d.name LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`);
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

module.exports = new DocumentRepository();
