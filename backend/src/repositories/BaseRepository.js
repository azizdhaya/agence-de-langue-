const db = require('../models/database');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * Allowlist an ORDER BY clause: comma-separated `identifier [ASC|DESC]`
   * (dotted table prefixes accepted). Anything else falls back, so a hostile
   * `?order=` can never reach the SQL even if a future caller forwards it.
   */
  static sanitizeOrder(value, fallback) {
    if (typeof value !== 'string' || value.trim() === '') return fallback;
    const parts = value.split(',');
    for (const part of parts) {
      if (!/^[A-Za-z_][\w.]*(\s+(ASC|DESC))?$/i.test(part.trim())) return fallback;
    }
    return value;
  }

  /**
   * Drop where-keys that are not plain identifiers. Express parses nested
   * query strings (?where[x]=..) into objects, so keys must never be trusted.
   */
  static sanitizeWhere(where = {}) {
    const clean = {};
    for (const [key, value] of Object.entries(where)) {
      if (/^[A-Za-z_]\w*$/.test(key)) clean[key] = value;
    }
    return clean;
  }

  /**
   * Convert camelCase keys to snake_case column names.
   * Accepts both snake_case and camelCase input; output is always snake_case.
   */
  static toSnakeCase(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      const snakeKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      result[snakeKey] = value;
    }
    return result;
  }

  /**
   * Convert snake_case columns to camelCase object keys for API responses.
   */
  static toCamelCase(row) {
    if (!row || typeof row !== 'object') return row;
    const result = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }

  static mapRows(rows) {
    return (rows || []).map(row => BaseRepository.toCamelCase(row));
  }

  async findAll(options = {}) {
    const { where = {}, order = 'id DESC', limit, offset } = options;
    const safeWhere = BaseRepository.sanitizeWhere(where);
    const safeOrder = BaseRepository.sanitizeOrder(order, 'id DESC');
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];

    if (Object.keys(safeWhere).length > 0) {
      const conditions = Object.keys(safeWhere).map(key => {
        params.push(safeWhere[key]);
        return `${key} = ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY ${safeOrder}`;

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

  async findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(BaseRepository.toCamelCase(row));
      });
    });
  }

  async findOne(where) {
    const mapped = BaseRepository.toSnakeCase(where);
    const conditions = Object.keys(mapped).map(key => `${key} = ?`);
    const params = Object.values(mapped);
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`, params, (err, row) => {
        if (err) reject(err);
        else resolve(BaseRepository.toCamelCase(row));
      });
    });
  }

  async create(data) {
    const mapped = BaseRepository.toSnakeCase(data);
    const keys = Object.keys(mapped);
    const values = Object.values(mapped);
    const placeholders = keys.map(() => '?').join(', ');
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  async update(id, data) {
    const mapped = BaseRepository.toSnakeCase(data);
    const keys = Object.keys(mapped);
    const values = Object.values(mapped);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`,
        [...values, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  async delete(id) {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes > 0 });
      });
    });
  }

  async count(where = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];
    if (Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => {
        params.push(where[key]);
        return `${key} = ?`;
      });
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

module.exports = BaseRepository;
