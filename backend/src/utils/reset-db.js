/**
 * Database reset utility.
 * Deletes the SQLite database file so it can be recreated from scratch.
 * Usage: npm run db:reset
 *
 * WARNING: This permanently deletes all data.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = process.env.DB_PATH || './database/language_center.db';
const resolvedPath = path.resolve(dbPath);

console.log(`⚠️  WARNING: This will permanently delete the database at:`);
console.log(`   ${resolvedPath}`);

if (!fs.existsSync(resolvedPath)) {
  console.log('\nℹ️  Database file does not exist. Nothing to do.');
  process.exit(0);
}

const size = (fs.statSync(resolvedPath).size / 1024).toFixed(2);
console.log(`\n   Current size: ${size} KB`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nType "RESET" to confirm deletion: ', (answer) => {
  rl.close();

  if (answer.trim().toUpperCase() !== 'RESET') {
    console.log('\n❌ Reset cancelled. Database untouched.');
    process.exit(0);
  }

  try {
    fs.unlinkSync(resolvedPath);
    console.log('\n✅ Database deleted. Run "npm run seed" to recreate it.');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Failed to delete database: ${error.message}`);
    console.error('   Close any running server or DB tools and try again.');
    process.exit(1);
  }
});