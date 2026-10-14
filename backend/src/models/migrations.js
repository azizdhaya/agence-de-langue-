/**
 * Schema Migrations
 * Adds missing columns to existing tables without data loss.
 * Each migration runs once and is recorded in the schema_migrations table.
 *
 * NOTE: `db` is injected as a parameter to avoid a circular dependency
 * with models/database.js
 */

const migrations = [
  {
    version: '002',
    name: 'add_enrollment_financial_columns',
    columns: [
      { table: 'enrollments', column: 'group_id', definition: 'INTEGER' },
      { table: 'enrollments', column: 'price', definition: 'REAL' },
      { table: 'enrollments', column: 'discount', definition: 'REAL DEFAULT 0' },
      { table: 'enrollments', column: 'amount_paid', definition: 'REAL DEFAULT 0' },
      { table: 'enrollments', column: 'balance', definition: 'REAL DEFAULT 0' },
      { table: 'enrollments', column: 'start_date', definition: 'TEXT' },
      { table: 'enrollments', column: 'end_date', definition: 'TEXT' }
    ]
  },
  {
    version: '003',
    name: 'add_attendance_session_columns',
    columns: [
      { table: 'attendance', column: 'session_id', definition: 'INTEGER' },
      { table: 'attendance', column: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { table: 'attendance', column: 'updated_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
    ]
  },
  {
    version: '004',
    name: 'add_grade_skill',
    columns: [
      { table: 'grades', column: 'skill_id', definition: 'INTEGER' }
    ]
  },
  {
    version: '012',
    name: 'add_cefr_sublevels_and_student_language_profile',
    // The `levels` table held only the six main CEFR codes (A1..C2), each tied
    // to a single language. This migration:
    //  - adds `parent_code` (A1..C2, NULL on the main levels themselves) and
    //    `framework` ('CEFR' today, another system tomorrow) to `levels`;
    //  - renumbers `order_index` onto a tens grid (A1=10, A1.1=11, A1.2=12,
    //    A2=20, ...) so ORDER BY order_index is always the true CEFR order;
    //  - seeds the twelve official sub-levels A1.1..C2.2 (idempotent);
    //  - creates `student_languages` (one row per student+language, with a
    //    global level plus one level per skill), `level_history` (every change,
    //    never overwritten) and `placement_bands` (configurable score->level
    //    mapping seeded with the centre's default thresholds);
    //  - adds nullable `language_id` / `level_id` to `courses` so a course can
    //    point at a language and a CEFR level. The legacy TEXT columns
    //    (`language`, `level`) are left untouched: existing rows keep working.
    columns: [
      { table: 'levels', column: 'parent_code', definition: 'TEXT' },
      { table: 'levels', column: 'framework', definition: "TEXT NOT NULL DEFAULT 'CEFR'" },
      { table: 'courses', column: 'language_id', definition: 'INTEGER' },
      { table: 'courses', column: 'level_id', definition: 'INTEGER' }
    ],
    createTables: [
      `CREATE TABLE IF NOT EXISTS student_languages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        language_id INTEGER NOT NULL,
        global_level_id INTEGER,
        listening_level_id INTEGER,
        reading_level_id INTEGER,
        speaking_level_id INTEGER,
        writing_level_id INTEGER,
        assessment_method TEXT,
        assessment_score REAL,
        assessed_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (language_id) REFERENCES languages(id),
        FOREIGN KEY (global_level_id) REFERENCES levels(id),
        FOREIGN KEY (listening_level_id) REFERENCES levels(id),
        FOREIGN KEY (reading_level_id) REFERENCES levels(id),
        FOREIGN KEY (speaking_level_id) REFERENCES levels(id),
        FOREIGN KEY (writing_level_id) REFERENCES levels(id),
        UNIQUE(student_id, language_id)
      )`,
      `CREATE TABLE IF NOT EXISTS level_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_language_id INTEGER NOT NULL,
        old_level_id INTEGER,
        new_level_id INTEGER NOT NULL,
        changed_by INTEGER,
        reason TEXT,
        method TEXT,
        score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_language_id) REFERENCES student_languages(id) ON DELETE CASCADE,
        FOREIGN KEY (old_level_id) REFERENCES levels(id),
        FOREIGN KEY (new_level_id) REFERENCES levels(id),
        FOREIGN KEY (changed_by) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS placement_bands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        min_score REAL NOT NULL,
        max_score REAL NOT NULL,
        level_id INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (level_id) REFERENCES levels(id),
        UNIQUE(min_score, max_score)
      )`
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_levels_parent_code ON levels(parent_code)',
      'CREATE INDEX IF NOT EXISTS idx_levels_framework ON levels(framework)',
      'CREATE INDEX IF NOT EXISTS idx_levels_order ON levels(order_index)',
      'CREATE INDEX IF NOT EXISTS idx_student_languages_student ON student_languages(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_student_languages_language ON student_languages(language_id)',
      'CREATE INDEX IF NOT EXISTS idx_level_history_student_language ON level_history(student_language_id)',
      'CREATE INDEX IF NOT EXISTS idx_courses_language_id ON courses(language_id)',
      'CREATE INDEX IF NOT EXISTS idx_courses_level_id ON courses(level_id)'
    ],
    dataUp: async function (db) {
      const run = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve(this);
        });
      });
      const get = (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
      });

      // 1. Renumber the six main levels onto the tens grid (idempotent: only
      // rows still on the old 1..6 numbering move).
      const parents = { A1: 10, A2: 20, B1: 30, B2: 40, C1: 50, C2: 60 };
      for (const [code, order] of Object.entries(parents)) {
        await run(
          `UPDATE levels SET order_index = ?, parent_code = NULL
           WHERE code = ? AND (order_index != ? OR parent_code IS NOT NULL)`,
          [order, code, order]
        );
      }

      // 2. Seed the twelve official sub-levels. INSERT OR IGNORE keeps this
      // idempotent on the UNIQUE(code) column.
      const names = {
        A1: 'Débutant', A2: 'Élémentaire', B1: 'Intermédiaire',
        B2: 'Intermédiaire supérieur', C1: 'Avancé', C2: 'Compétent'
      };
      let seeded = 0;
      for (const [parent, order] of Object.entries(parents)) {
        for (const sub of [1, 2]) {
          const code = `${parent}.${sub}`;
          const result = await run(
            `INSERT OR IGNORE INTO levels
               (code, name, description, order_index, parent_code, framework, is_active)
             VALUES (?, ?, ?, ?, ?, 'CEFR', 1)`,
            [code, `${names[parent]} ${code}`, `Niveau ${code} du cadre européen commun de référence`, order + sub, parent]
          );
          seeded += result.changes;
        }
      }
      if (seeded > 0) console.log(`  + Seeded ${seeded} CEFR sub-level(s)`);

      // 3. Detach sub-levels from any single language: a CEFR level is valid
      // for every language. Legacy rows may carry language_id from the old
      // seed (all six parents were tied to French); main levels keep theirs
      // for compatibility, sub-levels stay language-neutral (NULL).
      await run('UPDATE levels SET language_id = NULL WHERE parent_code IS NOT NULL');

      // 4. Seed the default placement bands (configurable by the admin later).
      // These are the centre's thresholds, not an official CEFR norm.
      const bands = [
        [0, 19, 'A1.1'], [20, 34, 'A1.2'], [35, 49, 'A2.1'], [50, 59, 'A2.2'],
        [60, 69, 'B1.1'], [70, 79, 'B1.2'], [80, 84, 'B2.1'], [85, 89, 'B2.2'],
        [90, 94, 'C1.1'], [95, 97, 'C1.2'], [98, 99, 'C2.1'], [100, 100, 'C2.2']
      ];
      let bandCount = 0;
      for (const [min, max, code] of bands) {
        const level = await get('SELECT id FROM levels WHERE code = ?', [code]);
        if (!level) continue;
        const result = await run(
          'INSERT OR IGNORE INTO placement_bands (min_score, max_score, level_id) VALUES (?, ?, ?)',
          [min, max, level.id]
        );
        bandCount += result.changes;
      }
      if (bandCount > 0) console.log(`  + Seeded ${bandCount} placement band(s)`);
    }
  },
  {
    version: '018',
    name: 'add_course_type_and_mode',
    // The course is the training offer; the group is the scheduled session.
    // These two offer-level attributes live on the course so they are not
    // duplicated per group: the kind of training and the delivery mode.
    // Plain ADD COLUMN, existing rows stay NULL (= not specified).
    columns: [
      { table: 'courses', column: 'course_type', definition: 'TEXT' },
      { table: 'courses', column: 'mode', definition: 'TEXT' }
    ]
  },
  {
    version: '020',
    name: 'drop_financial_tables',
    // The financial module (invoices, payments, receipts, tariffs, discounts,
    // payment methods, currencies, centre invoicing settings and document
    // numbering) is being rebuilt from scratch. Its tables are dropped here so
    // existing databases lose the old schema; models/database.js no longer
    // creates them. Child tables are dropped before the parents they reference.
    // Best-effort: every statement is IF EXISTS and failures on optional
    // legacy objects are ignored, so an unusual database cannot block startup.
    async dataUp(db) {
      const exec = (sql) => new Promise((resolve) => {
        db.run(sql, (err) => {
          if (err) console.warn(`  ! Financial cleanup skipped: ${err.message}`);
          resolve();
        });
      });
      const tables = [
        'payment_allocations',
        'invoice_items',
        'receipts',
        'payments',
        'invoices',
        'tariffs',
        'discount_rules',
        'payment_methods',
        'currencies',
        'center_settings',
        'document_sequences',
        'quote_items',
        'quotes'
      ];
      for (const table of tables) {
        await exec(`DROP TABLE IF EXISTS ${table}`);
      }
      // Course tariff link (migration 019). Dropped when the SQLite build
      // supports it; an unused nullable column is harmless otherwise.
      await exec('ALTER TABLE courses DROP COLUMN tariff_id');
      console.log('  - Dropped financial tables');
    }
  },
  {
    version: '021',
    name: 'add_course_module_catalogue',
    // The offer hierarchy: a course is split into ordered modules, and each
    // module into ordered submodules. The branchable leaf is the submodule and
    // it carries the catalogue price (integer millimes) — a module has no price
    // of its own, its total is the sum of its submodules. `discount_percent` is
    // the module's default whole-module discount, offered (and editable) when
    // an admin settles the module in one payment.
    createTables: [
      `CREATE TABLE IF NOT EXISTS course_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        discount_percent REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS module_submodules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        price_millimes INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE
      )`
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id)',
      'CREATE INDEX IF NOT EXISTS idx_module_submodules_module ON module_submodules(module_id)'
    ]
  },
  {
    version: '022',
    name: 'add_enrollment_module_charges',
    // What a student owes: registering to a module snapshots one charge per
    // submodule into `enrollment_submodules`. The price is copied from the
    // catalogue (or overridden per enrolment) so later catalogue edits never
    // touch an existing debt. `discount_millimes` holds the share of a
    // whole-module discount, `amount_paid_millimes` is maintained from the
    // payment allocations and `balance_millimes` is its cache (recomputed in
    // the same transaction as any payment). The applied discount percent is
    // stored on the module registration for audit.
    createTables: [
      `CREATE TABLE IF NOT EXISTS enrollment_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        module_id INTEGER NOT NULL,
        discount_percent REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'dropped')),
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        settled_at DATETIME,
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE,
        UNIQUE(enrollment_id, module_id)
      )`,
      `CREATE TABLE IF NOT EXISTS enrollment_submodules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_module_id INTEGER NOT NULL,
        submodule_id INTEGER NOT NULL,
        price_millimes INTEGER NOT NULL DEFAULT 0,
        discount_millimes INTEGER NOT NULL DEFAULT 0,
        amount_paid_millimes INTEGER NOT NULL DEFAULT 0,
        balance_millimes INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid')),
        due_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (enrollment_module_id) REFERENCES enrollment_modules(id) ON DELETE CASCADE,
        FOREIGN KEY (submodule_id) REFERENCES module_submodules(id) ON DELETE CASCADE,
        UNIQUE(enrollment_module_id, submodule_id)
      )`
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_enrollment_modules_enrollment ON enrollment_modules(enrollment_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollment_modules_module ON enrollment_modules(module_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollment_submodules_enrollment_module ON enrollment_submodules(enrollment_module_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollment_submodules_submodule ON enrollment_submodules(submodule_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollment_submodules_status ON enrollment_submodules(status)'
    ]
  },
  {
    version: '023',
    name: 'add_session_submodule',
    // A séance belongs to a submodule: this link gives each submodule charge its
    // due date (the first séance of that submodule in the student's group) and
    // drives the "unpaid submodule blocks attendance" rule. Existing sessions
    // stay unlinked (NULL) until an admin maps them.
    columns: [
      { table: 'sessions', column: 'submodule_id', definition: 'INTEGER' }
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_sessions_submodule_id ON sessions(submodule_id)'
    ]
  },
  {
    version: '024',
    name: 'add_payments_and_allocations',
    // Money received and how it settles the submodule charges. A payment is
    // student-scoped and can be spread over several modules; each allocation
    // points at one submodule charge and settles it in full. The allocation
    // rows are the single source of truth for what is paid — the cache columns
    // on enrollment_submodules are recomputed from them in the same
    // transaction, never maintained independently.
    createTables: [
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        amount_millimes INTEGER NOT NULL CHECK(amount_millimes >= 0),
        method TEXT NOT NULL CHECK(method IN ('cash', 'card', 'transfer', 'check', 'other')),
        reference TEXT,
        note TEXT,
        paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        recorded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS payment_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        enrollment_submodule_id INTEGER NOT NULL,
        amount_millimes INTEGER NOT NULL CHECK(amount_millimes >= 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
        FOREIGN KEY (enrollment_submodule_id) REFERENCES enrollment_submodules(id) ON DELETE CASCADE,
        UNIQUE(payment_id, enrollment_submodule_id)
      )`
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at)',
      'CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id)',
      'CREATE INDEX IF NOT EXISTS idx_payment_allocations_submodule ON payment_allocations(enrollment_submodule_id)'
    ]
  }
];

function tableExists(db, tableName) {
  return new Promise((resolve) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName],
      (err, row) => resolve(!err && !!row)
    );
  });
}

function columnExists(db, tableName, columnName) {
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(rows.some(r => r.name === columnName));
    });
  });
}

async function applyColumnChanges(db, columns) {
  for (const stmt of columns) {
    const tableOk = await tableExists(db, stmt.table);
    if (!tableOk) continue;

    const columnOk = await columnExists(db, stmt.table, stmt.column);
    if (columnOk) continue;

    await new Promise((resolve, reject) => {
      db.run(
        `ALTER TABLE ${stmt.table} ADD COLUMN ${stmt.column} ${stmt.definition}`,
        (err) => (err ? reject(err) : resolve())
      );
    });
    console.log(`  + Added ${stmt.table}.${stmt.column}`);
  }
}

/**
 * Create any tables listed in `createTables` that do not exist yet.
 * Each statement uses CREATE TABLE IF NOT EXISTS so it is idempotent.
 */
async function applyTableChanges(db, statements) {
  for (const sql of statements) {
    await new Promise((resolve, reject) => {
      db.run(sql, (err) => (err ? reject(err) : resolve()));
    });
  }
}

/**
 * Create any indexes listed in `indexes`.
 * Runs after `columns` so indexes on newly added columns can be created.
 */
async function applyIndexChanges(db, statements) {
  for (const sql of statements) {
    await new Promise((resolve, reject) => {
      db.run(sql, (err) => (err ? reject(err) : resolve()));
    });
  }
}

function ensureMigrationsTable(db) {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function getAppliedMigrations(db) {
  return new Promise((resolve) => {
    db.all('SELECT version FROM schema_migrations', (err, rows) => {
      if (err) {
        resolve([]);
        return;
      }
      resolve(rows.map(r => r.version));
    });
  });
}

function recordMigration(db, version, name) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
      [version, name],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

/**
 * Run all pending migrations.
 * @param {object} db sqlite3 database instance
 * @param {object} [options]
 * @param {boolean} [options.silent] suppress console output
 * @returns {Promise<{applied: number, versions: string[]}>}
 */
async function runMigrations(db, options = {}) {
  const silent = options.silent === true;
  const log = (msg) => {
    if (!silent) console.log(msg);
  };

  try {
    await ensureMigrationsTable(db);
    const applied = await getAppliedMigrations(db);
    const pending = migrations.filter(m => !applied.includes(m.version));

    if (pending.length === 0) {
      log('Database schema up to date');
      return { applied: 0, versions: [] };
    }

    log(`Running ${pending.length} migration(s)...`);

    const versions = [];
    for (const migration of pending) {
      log(`  -> ${migration.version}: ${migration.name}`);

      // Schema first, data second. A dataUp frequently reads columns added by the
      // very same migration (e.g. backfilling a freshly added column), so running
      // it first would fail on a column that does not exist yet.
      if (migration.createTables && migration.createTables.length > 0) {
        await applyTableChanges(db, migration.createTables);
      }
      if (migration.columns && migration.columns.length > 0) {
        await applyColumnChanges(db, migration.columns);
      }
      if (migration.indexes && migration.indexes.length > 0) {
        await applyIndexChanges(db, migration.indexes);
      }
      if (typeof migration.dataUp === 'function') {
        await migration.dataUp(db);
      }
      await recordMigration(db, migration.version, migration.name);
      versions.push(migration.version);
    }

    log(`Migrations applied successfully: ${versions.join(', ')}`);
    return { applied: pending.length, versions };
  } catch (error) {
    console.error('Migration error:', error.message);
    throw error;
  }
}

module.exports = runMigrations;
module.exports.migrations = migrations;
