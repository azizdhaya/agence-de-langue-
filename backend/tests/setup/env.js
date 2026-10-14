/**
 * Jest `setupFiles` entry point.
 *
 * Runs in each worker's process, before any test file is loaded, which matters
 * because src/models/database.js reads process.env.DB_PATH once at require time.
 *
 * Each worker gets its OWN database file. Sharing one file across workers looks
 * simpler but is genuinely broken: every worker is a separate process with its
 * own SQLite connection, and the `transaction()` helper in dbHelpers only
 * serialises transactions within a single process. Two workers whose transactions
 * both start with a read and then write make SQLite refuse the lock upgrade with
 * SQLITE_BUSY, which busy_timeout does not retry - producing intermittent failures
 * that look like flaky assertions.
 *
 * One file per worker removes the contention and gives every suite true
 * isolation, so a test can neither inherit nor leak rows.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const databaseDir = path.join(rootDir, 'database');

const devDbPath = path.resolve(databaseDir, 'language_center.db');
const workerId = process.env.JEST_WORKER_ID || '1';
const testDbPath = path.resolve(databaseDir, `test-${workerId}.db`);

process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

// Safety net: tests must never touch the development database.
if (path.resolve(process.env.DB_PATH) === devDbPath) {
  throw new Error('Refusing to run tests against the development database');
}

// globalSetup copies one database per worker from a single seeded template. This
// fallback only triggers when a worker index exceeds what it prepared (e.g. a
// custom --maxWorkers higher than the default cap).
if (!fs.existsSync(testDbPath)) {
  execFileSync(process.execPath, [path.join(rootDir, 'src', 'utils', 'seed.js')], {
    cwd: rootDir,
    env: { ...process.env, DB_PATH: testDbPath, NODE_ENV: 'test' },
    stdio: 'pipe'
  });
}