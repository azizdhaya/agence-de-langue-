const BaseRepository = require('./BaseRepository');
const db = require('../models/database');

class NotificationRepository extends BaseRepository {
  constructor() {
    super('notifications');
  }

  async findAllWithDetails(options = {}) {
    const { where = {}, order = 'n.created_at DESC', limit, offset, search } = options;
    let sql = `
      SELECT n.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email
      FROM notifications n
      JOIN users u ON n.user_id = u.id
    `;
    const params = [];

    const conditions = [];
    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`n.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(n.title LIKE ? OR n.message LIKE ?)`);
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
        SELECT n.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email
        FROM notifications n
        JOIN users u ON n.user_id = u.id
        WHERE n.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async findByUser(userId, unreadOnly = false) {
    const where = { user_id: userId };
    if (unreadOnly) where.is_read = 0;
    return this.findAll({ where });
  }

  async markAsRead(id) {
    return this.update(id, { is_read: 1 });
  }

  async markAllAsRead(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId],
        function(err) {
          if (err) reject(err);
          else resolve({ updated: this.changes });
        }
      );
    });
  }

  async countUnread(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
  }

  async countWithFilters(where = {}, search) {
    let sql = 'SELECT COUNT(*) as count FROM notifications n';
    const params = [];
    const conditions = [];

    if (Object.keys(where).length > 0) {
      Object.keys(where).forEach(key => {
        params.push(where[key]);
        conditions.push(`n.${key} = ?`);
      });
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(n.title LIKE ? OR n.message LIKE ?)`);
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

module.exports = new NotificationRepository();