const db = require('../models/database');

// Middleware to wrap route handler in a transaction
function withTransaction(handler) {
  return async (req, res, next) => {
    try {
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await handler(req, res, next);

      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      await new Promise((resolve) => {
        db.run('ROLLBACK', () => resolve());
      });
      next(error);
    }
  };
}

// Helper to execute multiple operations in a transaction
async function executeTransaction(operations) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const results = [];
      let hasError = false;

      for (const operation of operations) {
        try {
          const result = operation();
          results.push(result);
        } catch (error) {
          hasError = true;
          db.run('ROLLBACK');
          reject(error);
          return;
        }
      }

      if (!hasError) {
        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            resolve(results);
          }
        });
      }
    });
  });
}

module.exports = {
  withTransaction,
  executeTransaction
};
