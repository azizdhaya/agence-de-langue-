const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

class StudentRepository extends BaseRepository {
  constructor() {
    super('students');
  }

  async findAllWithUsers(options = {}) {
    const { where = {}, order = 'u.created_at DESC', limit, offset, search } = options;
    let sql = `
      SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.avatar, u.created_at, u.updated_at
      FROM students s
      JOIN users u ON s.user_id = u.id
    `;
    const params = [];

    const conditions = [];
    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`s.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`);
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

  async findByIdWithUser(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.avatar, u.created_at, u.updated_at
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.avatar, u.created_at, u.updated_at
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = ?
      `, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async countWithFilters(where = {}, search) {
    let sql = `
      SELECT COUNT(*) as count
      FROM students s
      JOIN users u ON s.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`s.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`);
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

module.exports = new StudentRepository();
