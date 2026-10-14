const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './database/language_center.db';

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Users table (for both students and teachers)
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
      phone TEXT,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Students extended info
    db.run(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      date_of_birth TEXT,
      address TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      level TEXT DEFAULT 'beginner',
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'graduated', 'suspended')),
      enrollment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Teachers extended info
    db.run(`CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      specialization TEXT,
      qualifications TEXT,
      bio TEXT,
      hourly_rate REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave')),
      hire_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Languages table
    db.run(`CREATE TABLE IF NOT EXISTS languages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      flag TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Levels table (CEFR)
    db.run(`CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL,
      parent_code TEXT,
      framework TEXT NOT NULL DEFAULT 'CEFR',
      language_id INTEGER,
      duration_hours INTEGER,
      prerequisites TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (language_id) REFERENCES languages(id)
    )`);

    // Skills table
    db.run(`CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Courses table
    db.run(`CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      language TEXT NOT NULL,
      level TEXT NOT NULL,
      language_id INTEGER,
      level_id INTEGER,
      teacher_id INTEGER,
      max_students INTEGER DEFAULT 20,
      start_date TEXT,
      end_date TEXT,
      schedule TEXT,
      room TEXT,
      price REAL NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    )`);

    // Student language profiles: one row per student + language, with a global
    // CEFR level plus one level per skill. Added by migration 012 on existing
    // databases; created here for fresh ones.
    db.run(`CREATE TABLE IF NOT EXISTS student_languages (
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
    )`);

    // Level history: every global-level change, never overwritten.
    db.run(`CREATE TABLE IF NOT EXISTS level_history (
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
    )`);

    // Placement bands: configurable score -> CEFR level mapping.
    db.run(`CREATE TABLE IF NOT EXISTS placement_bands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      min_score REAL NOT NULL,
      max_score REAL NOT NULL,
      level_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (level_id) REFERENCES levels(id),
      UNIQUE(min_score, max_score)
    )`);

    // Groups table
    db.run(`CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      course_id INTEGER NOT NULL,
      teacher_id INTEGER,
      room TEXT,
      max_students INTEGER DEFAULT 20,
      start_date TEXT,
      end_date TEXT,
      schedule TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    )`);

    // Enrollments table
    db.run(`CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      group_id INTEGER,
      enrollment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'dropped', 'suspended')),
      price REAL,
      discount REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      UNIQUE(student_id, course_id)
    )`);

    // Sessions table. `submodule_id` links a séance to the submodule it teaches
    // (added by migration 023 on existing databases); it feeds each charge's
    // due date and the "unpaid submodule blocks attendance" rule.
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      teacher_id INTEGER,
      room TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      submodule_id INTEGER,
      status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled', 'postponed')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (submodule_id) REFERENCES module_submodules(id) ON DELETE SET NULL
    )`);

    // Course modules: ordered parts of a course. A module has no price; the
    // billable leaf is its submodules. `discount_percent` is the default
    // whole-module discount offered when an admin settles the module in one go.
    db.run(`CREATE TABLE IF NOT EXISTS course_modules (
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
    )`);

    // Module submodules: the billable leaf. It carries the catalogue price in
    // integer millimes (1 TND = 1000 millimes).
    db.run(`CREATE TABLE IF NOT EXISTS module_submodules (
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
    )`);

    // What a student owes: one charge per module (enrollment_modules) and one
    // per submodule (enrollment_submodules). Prices are snapshots taken at
    // registration so catalogue edits never touch an existing debt.
    db.run(`CREATE TABLE IF NOT EXISTS enrollment_modules (
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
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS enrollment_submodules (
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
    )`);

    // Money actually received (payments) and how it is spread over the
    // submodule charges (payment_allocations). An allocation always settles a
    // submodule in full, so the allocation rows are the single source of truth
    // for what is paid; the cache columns on enrollment_submodules are
    // recomputed from them inside the same transaction.
    db.run(`CREATE TABLE IF NOT EXISTS payments (
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
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      enrollment_submodule_id INTEGER NOT NULL,
      amount_millimes INTEGER NOT NULL CHECK(amount_millimes >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
      FOREIGN KEY (enrollment_submodule_id) REFERENCES enrollment_submodules(id) ON DELETE CASCADE,
      UNIQUE(payment_id, enrollment_submodule_id)
    )`);

    // Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )`);

    // Attendance table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      session_id INTEGER,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late', 'excused')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      UNIQUE(student_id, course_id, date)
    )`);

    // Grades table
    db.run(`CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      skill_id INTEGER,
      assessment_type TEXT NOT NULL,
      score REAL NOT NULL,
      max_score REAL DEFAULT 100,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (skill_id) REFERENCES skills(id)
    )`);

    // Certificates table
    db.run(`CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_number TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL,
      course_id INTEGER,
      level TEXT NOT NULL,
      score REAL,
      issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiry_date TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'expired')),
      qr_code TEXT,
      verification_url TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )`);

    // Documents table
    db.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      student_id INTEGER,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('contract', 'id', 'certificate', 'transcript', 'other')),
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )`);

    // Announcements table
    db.run(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      target_audience TEXT DEFAULT 'all' CHECK(target_audience IN ('all', 'students', 'teachers')),
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )`);

    // Notifications table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info' CHECK(type IN ('info', 'warning', 'success', 'error')),
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Audit logs table
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Branches table (for multi-site support)
    db.run(`CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Refresh tokens table
    db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Create indexes for performance
    createIndexes();

    console.log('✅ Database tables initialized');
  });
}

function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)',
    'CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status)',
    'CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id)',
    'CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status)',
    'CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status)',
    'CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_course_id ON attendance(course_id)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)',
    'CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_grades_course_id ON grades(course_id)',
    'CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON sessions(group_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_submodule_id ON sessions(submodule_id)',
    'CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id)',
    'CREATE INDEX IF NOT EXISTS idx_module_submodules_module ON module_submodules(module_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollment_modules_enrollment ON enrollment_modules(enrollment_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollment_modules_module ON enrollment_modules(module_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollment_submodules_enrollment_module ON enrollment_submodules(enrollment_module_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollment_submodules_submodule ON enrollment_submodules(submodule_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollment_submodules_status ON enrollment_submodules(status)',
    'CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at)',
    'CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id)',
    'CREATE INDEX IF NOT EXISTS idx_payment_allocations_submodule ON payment_allocations(enrollment_submodule_id)',
    'CREATE INDEX IF NOT EXISTS idx_groups_course_id ON groups(course_id)',
    'CREATE INDEX IF NOT EXISTS idx_groups_teacher_id ON groups(teacher_id)',
    'CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_levels_language_id ON levels(language_id)',
    'CREATE INDEX IF NOT EXISTS idx_levels_parent_code ON levels(parent_code)',
    'CREATE INDEX IF NOT EXISTS idx_levels_framework ON levels(framework)',
    'CREATE INDEX IF NOT EXISTS idx_levels_order ON levels(order_index)',
    'CREATE INDEX IF NOT EXISTS idx_student_languages_student ON student_languages(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_student_languages_language ON student_languages(language_id)',
    'CREATE INDEX IF NOT EXISTS idx_level_history_student_language ON level_history(student_language_id)',
    'CREATE INDEX IF NOT EXISTS idx_courses_language_id ON courses(language_id)',
    'CREATE INDEX IF NOT EXISTS idx_courses_level_id ON courses(level_id)'
  ];

  indexes.forEach(index => {
    db.run(index, (err) => {
      if (err) console.error('Index creation error:', err.message);
    });
  });

  console.log('✅ Database indexes created');
}

module.exports = db;
module.exports.createIndexes = createIndexes;
