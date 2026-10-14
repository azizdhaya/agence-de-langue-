/**
 * Jest `globalSetup` entry point: runs once, before any worker starts.
 *
 * Builds one database per worker (database/test-<id>.db) so that suites running
 * in parallel processes never contend for the same SQLite file. See
 * tests/setup/env.js for why a shared file is not viable.
 *
 * The databases are seeded here, sequentially, rather than lazily inside each
 * worker: the seed hashes three bcrypt passwords, so running one per worker in
 * parallel saturates the CPU and pushes unrelated tests past their timeouts.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const databaseDir = path.join(rootDir, 'database');
const TEMPLATE = path.join(databaseDir, 'test-template.db');

// Jest's default worker count, capped so a many-core machine does not create a
// dozen databases for a handful of suites.
const MAX_WORKERS = Math.min(Math.max(os.cpus().length - 1, 1), 8);

module.exports = async () => {
  // Clear leftovers from a previous run, journals included so SQLite cannot try
  // to roll deleted pages back in.
  let removed = 0;
  for (const entry of fs.readdirSync(databaseDir)) {
    if (/^test(-\d+|-template)?\.db(-journal|-wal|-shm)?$/.test(entry)) {
      fs.unlinkSync(path.join(databaseDir, entry));
      removed++;
    }
  }

  // Seed ONCE, then copy the file per worker. Seeding hashes three bcrypt
  // passwords, so running it per worker would cost MAX_WORKERS times the same
  // work and add that to every run.
  console.log(`\n🧪 Seeding test template`);
  execFileSync(process.execPath, [path.join(rootDir, 'src', 'utils', 'seed.js')], {
    cwd: rootDir,
    env: { ...process.env, DB_PATH: TEMPLATE, NODE_ENV: 'test' },
    stdio: 'pipe'
  });

  for (let id = 1; id <= MAX_WORKERS; id++) {
    fs.copyFileSync(TEMPLATE, path.join(databaseDir, `test-${id}.db`));
  }

  console.log(`🧪 Ready: ${MAX_WORKERS} isolated databases (${removed} stale file(s) cleared)`);
};