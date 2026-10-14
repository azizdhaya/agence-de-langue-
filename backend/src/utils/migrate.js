/**
 * Standalone migration runner.
 * Usage: npm run migrate
 */
const db = require('../models/database');
const runMigrations = require('../models/migrations');

setTimeout(async () => {
  console.log('Running database migrations...');

  try {
    const result = await runMigrations(db);
    console.log(`Done. ${result.applied} migration(s) applied.`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  }

  setTimeout(() => {
    db.close();
    process.exit(process.exitCode || 0);
  }, 300);
}, 1000);