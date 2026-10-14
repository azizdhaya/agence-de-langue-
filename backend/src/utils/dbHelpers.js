/**
 * Promisified sqlite3 helpers.
 * Provide awaitable wrappers around the callback-based sqlite3 API.
 */
const db = require('../models/database');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Run `fn` inside a SQLite transaction.
 *
 * `fn` is awaited before COMMIT, so it can perform any number of awaited
 * queries. A rejection rolls the whole transaction back.
 *
 * Transactions are serialised through a promise chain: node-sqlite3 queues
 * statements per connection, but two overlapping `transaction()` calls would
 * still interleave their BEGIN/COMMIT and SQLite rejects a nested BEGIN. The
 * chain guarantees one transaction at a time, which is what a single-process
 * SQLite app needs.
 *
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function transaction(fn) {
  const result = transactionQueue.then(() => runInTransaction(fn));
  // Keep the chain alive regardless of the outcome so a failed transaction
  // does not poison every later one.
  transactionQueue = result.catch(() => {});
  return result;
}

let transactionQueue = Promise.resolve();

async function runInTransaction(fn) {
  await run('BEGIN TRANSACTION');
  try {
    const value = await fn();
    await run('COMMIT');
    return value;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

/**
 * Insert a row if it does not already exist, then return its id.
 *
 * `match` describes how to recognise an existing row, e.g.
 *   { email: 'a@b.c' }         -> WHERE email = ?
 *   { user_id: 4 }             -> WHERE user_id = ?
 *   { course_id: 2, date: 'x' } -> WHERE course_id = ? AND date = ?
 *
 * The match values are read from `data`, so they must also be part of the
 * inserted columns.
 *
 * This keeps the seed idempotent without requiring a globally unique column
 * on every table.
 *
 * @param {string} table
 * @param {object} data column/value pairs to insert
 * @param {object} match column/value pairs identifying an existing row
 * @returns {Promise<number>} the row id
 */
async function insertIfMissing(table, data, match) {
  const matchKeys = Object.keys(match);

  if (matchKeys.length === 0) {
    throw new Error(
      `insertIfMissing('${table}'): match must contain at least one column`
    );
  }

  // 1. Look for an existing row
  const conditions = matchKeys.map(col => `${col} = ?`);
  const existing = await get(
    `SELECT id FROM ${table} WHERE ${conditions.join(' AND ')}`,
    Object.values(match)
  );

  if (existing) {
    return existing.id;
  }

  // 2. Insert a new one
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');

  const result = await run(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    values
  );

  return result.lastID;
}

module.exports = { run, get, all, insertIfMissing, transaction };