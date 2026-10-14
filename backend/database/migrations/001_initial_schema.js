const db = require('../../src/models/database');

const migration = {
  version: '001',
  name: 'initial_schema',
  description: 'Create initial database schema with all tables and indexes',

  up() {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');

        // Create tables (same as in database.js)
        const tables = [
          `CREATE TABLE IF NOT EXISTS users (
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
          )`,
          `CREATE TABLE IF NOT EXISTS students (
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
          )`,
          `CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            specialization TEXT,
            qualifications TEXT,
            bio TEXT,
            hourly_rate REAL DEFAULT 0,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave')),
            hire_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )`,
          `CREATE TABLE IF NOT EXISTS languages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            flag TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            order_index INTEGER NOT NULL,
            language_id INTEGER,
            duration_hours INTEGER,
            prerequisites TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (language_id) REFERENCES languages(id)
          )`,
          `CREATE TABLE IF NOT EXISTS skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            language TEXT NOT NULL,
            level TEXT NOT NULL,
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
          )`,
          `CREATE TABLE IF NOT EXISTS groups (
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
          )`,
          `CREATE TABLE IF NOT EXISTS enrollments (
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
          )`,
          `CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            teacher_id INTEGER,
            room TEXT,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled', 'postponed')),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id),
            FOREIGN KEY (teacher_id) REFERENCES teachers(id)
          )`,
          `CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            course_id INTEGER,
            enrollment_id INTEGER,
            amount REAL NOT NULL,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'online')),
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
            notes TEXT,
            receipt_number TEXT UNIQUE,
            FOREIGN KEY (student_id) REFERENCES students(id),
            FOREIGN KEY (course_id) REFERENCES courses(id),
            FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
          )`,
          `CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT UNIQUE NOT NULL,
            student_id INTEGER NOT NULL,
            enrollment_id INTEGER,
            amount REAL NOT NULL,
            discount REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total REAL NOT NULL,
            amount_paid REAL DEFAULT 0,
            balance REAL DEFAULT 0,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'partial', 'cancelled', 'refunded')),
            due_date TEXT,
            issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_date DATETIME,
            notes TEXT,
            FOREIGN KEY (student_id) REFERENCES students(id),
            FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
          )`,
          `CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
          )`,
          `CREATE TABLE IF NOT EXISTS attendance (
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
          )`,
          `CREATE TABLE IF NOT EXISTS grades (
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
          )`,
          `CREATE TABLE IF NOT EXISTS certificates (
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
          )`,
          `CREATE TABLE IF NOT EXISTS documents (
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
          )`,
          `CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            target_audience TEXT DEFAULT 'all' CHECK(target_audience IN ('all', 'students', 'teachers')),
            priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            FOREIGN KEY (author_id) REFERENCES users(id)
          )`,
          `CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info' CHECK(type IN ('info', 'warning', 'success', 'error')),
            is_read INTEGER DEFAULT 0,
            link TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )`,
          `CREATE TABLE IF NOT EXISTS audit_logs (
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
          )`,
          `CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )`
        ];

        tables.forEach(table => db.run(table));

        // Create indexes
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
          'CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id)',
          'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
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
          'CREATE INDEX IF NOT EXISTS idx_groups_course_id ON groups(course_id)',
          'CREATE INDEX IF NOT EXISTS idx_groups_teacher_id ON groups(teacher_id)',
          'CREATE INDEX IF NOT EXISTS idx_invoices_student_id ON invoices(student_id)',
          'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
          'CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id)',
          'CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_levels_language_id ON levels(language_id)'
        ];

        indexes.forEach(index => db.run(index));

        console.log('✅ Migration 001: Initial schema created');
        resolve();
      });
    });
  },

  down() {
    return new Promise((resolve, reject) => {
      const tables = [
        'refresh_tokens', 'branches', 'audit_logs', 'notifications',
        'announcements', 'documents', 'certificates', 'grades',
        'attendance', 'messages', 'invoices', 'payments', 'sessions',
        'enrollments', 'groups', 'courses', 'skills', 'levels',
        'languages', 'teachers', 'students', 'users'
      ];

      tables.forEach(table => db.run(`DROP TABLE IF EXISTS ${table}`));

      console.log('✅ Migration 001: Schema dropped');
      resolve();
    });
  }
};

module.exports = migration;
