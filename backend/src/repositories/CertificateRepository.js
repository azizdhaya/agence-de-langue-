const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

class CertificateRepository extends BaseRepository {
  constructor() {
    super('certificates');
  }

  async findAllWithDetails(options = {}) {
    const { where = {}, order = 'c.issue_date DESC', limit, offset, search } = options;
    let sql = `
      SELECT c.*, u.first_name || ' ' || u.last_name as student_name, u.email as student_email,
             co.name as course_name
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses co ON c.course_id = co.id
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
      params.push(`%${search}%`);
      conditions.push(`(c.certificate_number LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`);
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
        SELECT c.*, u.first_name || ' ' || u.last_name as student_name, u.email as student_email,
               co.name as course_name
        FROM certificates c
        JOIN students s ON c.student_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN courses co ON c.course_id = co.id
        WHERE c.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async findByCertificateNumber(certNumber) {
    return this.findOne({ certificate_number: certNumber });
  }

  async countWithFilters(where = {}, search) {
    let sql = `
      SELECT COUNT(*) as count
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      JOIN users u ON s.user_id = u.id
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
      params.push(`%${search}%`);
      conditions.push(`(c.certificate_number LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`);
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

module.exports = new CertificateRepository();
