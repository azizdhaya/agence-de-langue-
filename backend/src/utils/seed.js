/**
 * Database seed.
 *
 * - Executes sequentially (awaits every insert) so foreign keys are valid.
 * - Resolves real row ids instead of assuming fixed values.
 * - Idempotent: `insertIfMissing` skips rows that already exist.
 *
 * Usage: npm run seed
 */
const bcrypt = require('bcryptjs');
const db = require('../models/database');
const runMigrations = require('../models/migrations');
const { insertIfMissing, get, run } = require('./dbHelpers');
const paymentService = require('../services/PaymentService');

// Re-run index creation after migrations so indexes on newly added columns
// are created.
function ensureIndexes() {
  return new Promise((resolve) => {
    db.createIndexes();
    // createIndexes is synchronous (fire-and-forget), so resolve on next tick
    setImmediate(resolve);
  });
}

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    await runMigrations(db, { silent: true });
    await ensureIndexes();

    // ------------------------------------------------------------------
    // Users
    // ------------------------------------------------------------------
    const adminHash = await bcrypt.hash('admin123', 10);
    const teacherHash = await bcrypt.hash('teacher123', 10);
    const studentHash = await bcrypt.hash('student123', 10);

    const adminId = await insertIfMissing('users', {
      email: 'admin@center.com', password: adminHash,
      first_name: 'Admin', last_name: 'User', role: 'admin', phone: '+33600000001'
    }, { email: 'admin@center.com' });

    const teacher1UserId = await insertIfMissing('users', {
      email: 'teacher@center.com', password: teacherHash,
      first_name: 'Marie', last_name: 'Dupont', role: 'teacher', phone: '+33600000002'
    }, { email: 'teacher@center.com' });

    const teacher2UserId = await insertIfMissing('users', {
      email: 'teacher2@center.com', password: teacherHash,
      first_name: 'Jean', last_name: 'Martin', role: 'teacher', phone: '+33600000003'
    }, { email: 'teacher2@center.com' });

    const student1UserId = await insertIfMissing('users', {
      email: 'student@center.com', password: studentHash,
      first_name: 'Pierre', last_name: 'Bernard', role: 'student', phone: '+33600000004'
    }, { email: 'student@center.com' });

    const student2UserId = await insertIfMissing('users', {
      email: 'student2@center.com', password: studentHash,
      first_name: 'Sophie', last_name: 'Leroy', role: 'student', phone: '+33600000005'
    }, { email: 'student2@center.com' });

    const student3UserId = await insertIfMissing('users', {
      email: 'student3@center.com', password: studentHash,
      first_name: 'Lucas', last_name: 'Moreau', role: 'student', phone: '+33600000006'
    }, { email: 'student3@center.com' });

    // ------------------------------------------------------------------
    // Teacher / Student profiles
    // ------------------------------------------------------------------
    const teacher1Id = await insertIfMissing('teachers', {
      user_id: teacher1UserId, specialization: 'Français Langue Étrangère',
      qualifications: "Master FLE, 10 ans d'expérience",
      bio: 'Spécialiste en français pour étrangers', hourly_rate: 35
    }, { user_id: teacher1UserId });

    const teacher2Id = await insertIfMissing('teachers', {
      user_id: teacher2UserId, specialization: 'Anglais',
      qualifications: 'Master en linguistique, CELTA',
      bio: "Enseignant d'anglais expérimenté", hourly_rate: 30
    }, { user_id: teacher2UserId });

    const student1Id = await insertIfMissing('students', {
      user_id: student1UserId, date_of_birth: '1995-05-15',
      address: '123 Rue de Paris', level: 'intermediate'
    }, { user_id: student1UserId });

    const student2Id = await insertIfMissing('students', {
      user_id: student2UserId, date_of_birth: '1998-08-22',
      address: '456 Avenue des Champs', level: 'beginner'
    }, { user_id: student2UserId });

    const student3Id = await insertIfMissing('students', {
      user_id: student3UserId, date_of_birth: '1990-03-10',
      address: '789 Boulevard Central', level: 'advanced'
    }, { user_id: student3UserId });

    // ------------------------------------------------------------------
    // Languages
    // ------------------------------------------------------------------
    const langIds = {};
    const languages = [
      ['fr', 'Français', '🇫🇷'],
      ['en', 'Anglais', '🇬🇧'],
      ['es', 'Espagnol', '🇪🇸'],
      ['de', 'Allemand', '🇩🇪'],
      ['ar', 'Arabe', '🇸🇦']
    ];

    for (const [code, name, flag] of languages) {
      langIds[code] = await insertIfMissing('languages', { code, name, flag }, { code });
    }

    // ------------------------------------------------------------------
    // Levels (CEFR): six main levels on the tens grid (A1=10 ... C2=60) plus
    // the twelve official sub-levels (A1.1=11 ... C2.2=62), so
    // ORDER BY order_index is always the true CEFR order. Migration 012 does
    // the same on existing databases; the seed covers fresh ones.
    // ------------------------------------------------------------------
    const levelSeeds = [
      ['A1', 'Débutant', 'Peut comprendre et utiliser des expressions familières', 10, null, null, 60],
      ['A2', 'Élémentaire', 'Peut communiquer de manière simple', 20, null, 'A1', 80],
      ['B1', 'Intermédiaire', 'Peut comprendre les points essentiels', 30, null, 'A2', 100],
      ['B2', 'Intermédiaire supérieur', 'Peut comprendre le contenu essentiel de sujets concrets ou abstraits', 40, null, 'B1', 120],
      ['C1', 'Avancé', 'Peut comprendre une grande gamme de textes longs et exigeants', 50, null, 'B2', 150],
      ['C2', 'Compétent', "Peut comprendre sans effort pratiquement tout ce qu'il/elle lit ou entend", 60, null, 'C1', 200]
    ];
    const subNames = {
      A1: 'Débutant', A2: 'Élémentaire', B1: 'Intermédiaire',
      B2: 'Intermédiaire supérieur', C1: 'Avancé', C2: 'Compétent'
    };
    for (const [parent, , , order] of levelSeeds.slice(0, 6)) {
      for (const sub of [1, 2]) {
        levelSeeds.push([
          `${parent}.${sub}`,
          `${subNames[parent]} ${parent}.${sub}`,
          `Niveau ${parent}.${sub} du cadre européen commun de référence`,
          order + sub, parent, parent, null
        ]);
      }
    }

    for (const [code, name, description, order, parentCode, prereq, hours] of levelSeeds) {
      await insertIfMissing('levels', {
        code, name, description, order_index: order, parent_code: parentCode,
        framework: 'CEFR', language_id: parentCode ? null : langIds.fr,
        duration_hours: hours, prerequisites: prereq
      }, { code });
    }

    // ------------------------------------------------------------------
    // Skills
    // ------------------------------------------------------------------
    const skillIds = {};
    const skills = [
      ['listening', 'Listening', 'Compréhension orale'],
      ['speaking', 'Speaking', 'Expression orale'],
      ['reading', 'Reading', 'Compréhension écrite'],
      ['writing', 'Writing', 'Expression écrite'],
      ['grammar', 'Grammar', 'Grammaire'],
      ['vocabulary', 'Vocabulary', 'Vocabulaire']
    ];

    for (const [code, name, description] of skills) {
      skillIds[code] = await insertIfMissing('skills', { code, name, description }, { code });
    }

    // ------------------------------------------------------------------
    // Courses
    // ------------------------------------------------------------------
    const course1Id = await insertIfMissing('courses', {
      name: 'Français Débutant', description: 'Cours de français pour débutants',
      language: 'Français', level: 'beginner', teacher_id: teacher1Id,
      max_students: 15, start_date: '2024-01-15', end_date: '2024-06-15',
      schedule: 'Lun-Mer-Ven 9h-11h', room: 'Salle 101', price: 500
    }, { name: 'Français Débutant' });

    const course2Id = await insertIfMissing('courses', {
      name: 'Français Intermédiaire', description: 'Perfectionnement en français',
      language: 'Français', level: 'intermediate', teacher_id: teacher1Id,
      max_students: 12, start_date: '2024-01-15', end_date: '2024-06-15',
      schedule: 'Mar-Jeu 14h-16h', room: 'Salle 102', price: 600
    }, { name: 'Français Intermédiaire' });

    const course3Id = await insertIfMissing('courses', {
      name: 'Anglais Business', description: 'Anglais professionnel',
      language: 'Anglais', level: 'advanced', teacher_id: teacher2Id,
      max_students: 10, start_date: '2024-02-01', end_date: '2024-07-01',
      schedule: 'Lun-Mer 18h-20h', room: 'Salle 201', price: 700
    }, { name: 'Anglais Business' });

    // ------------------------------------------------------------------
    // Groups
    // ------------------------------------------------------------------
    const group1Id = await insertIfMissing('groups', {
      name: 'Groupe A1-1', course_id: course1Id, teacher_id: teacher1Id,
      room: 'Salle 101', max_students: 15,
      start_date: '2024-01-15', end_date: '2024-06-15', schedule: 'Lun-Mer-Ven 9h-11h'
    }, { name: 'Groupe A1-1' });

    const group2Id = await insertIfMissing('groups', {
      name: 'Groupe B1-1', course_id: course2Id, teacher_id: teacher1Id,
      room: 'Salle 102', max_students: 12,
      start_date: '2024-01-15', end_date: '2024-06-15', schedule: 'Mar-Jeu 14h-16h'
    }, { name: 'Groupe B1-1' });

    const group3Id = await insertIfMissing('groups', {
      name: 'Groupe C1-1', course_id: course3Id, teacher_id: teacher2Id,
      room: 'Salle 201', max_students: 10,
      start_date: '2024-02-01', end_date: '2024-07-01', schedule: 'Lun-Mer 18h-20h'
    }, { name: 'Groupe C1-1' });

    // ------------------------------------------------------------------
    // Sessions
    // ------------------------------------------------------------------
    const session1Id = await insertIfMissing('sessions', {
      group_id: group1Id, teacher_id: teacher1Id, room: 'Salle 101',
      date: '2024-01-15', start_time: '09:00', end_time: '11:00', status: 'completed'
    }, { group_id: group1Id, date: '2024-01-15' });

    const session2Id = await insertIfMissing('sessions', {
      group_id: group1Id, teacher_id: teacher1Id, room: 'Salle 101',
      date: '2024-01-17', start_time: '09:00', end_time: '11:00', status: 'completed'
    }, { group_id: group1Id, date: '2024-01-17' });

    const session3Id = await insertIfMissing('sessions', {
      group_id: group2Id, teacher_id: teacher1Id, room: 'Salle 102',
      date: '2024-01-16', start_time: '14:00', end_time: '16:00', status: 'completed'
    }, { group_id: group2Id, date: '2024-01-16' });

    // ------------------------------------------------------------------
    // Enrollments
    // ------------------------------------------------------------------
    const enrollment1Id = await insertIfMissing('enrollments', {
      student_id: student1Id, course_id: course2Id, group_id: group2Id,
      status: 'active', price: 600,
      start_date: '2024-01-15', end_date: '2024-06-15'
    }, { student_id: student1Id, course_id: course2Id });

    const enrollment2Id = await insertIfMissing('enrollments', {
      student_id: student2Id, course_id: course1Id, group_id: group1Id,
      status: 'active', price: 500,
      start_date: '2024-01-15', end_date: '2024-06-15'
    }, { student_id: student2Id, course_id: course1Id });

    const enrollment3Id = await insertIfMissing('enrollments', {
      student_id: student3Id, course_id: course3Id, group_id: group3Id,
      status: 'active', price: 700,
      start_date: '2024-02-01', end_date: '2024-07-01'
    }, { student_id: student3Id, course_id: course3Id });

    // ------------------------------------------------------------------
    // Course programme: modules and their submodules (the billable leaf).
    // A module has no price of its own; each submodule carries its catalogue
    // price in millimes (1 TND = 1000). discount_percent is the module's
    // default whole-module discount, offered when it is settled in one go.
    // ------------------------------------------------------------------
    const programme = [
      [course1Id, 'Module 1 — Fondations', 0, 10, [
        ['Sons et alphabet', 0, 120],
        ['Se présenter', 1, 130]
      ]],
      [course1Id, 'Module 2 — Vie quotidienne', 1, 10, [
        ['Au marché', 0, 125],
        ['Nombres et heures', 1, 125]
      ]],
      [course2Id, 'Module 1 — Grammaire avancée', 0, 15, [
        ['Temps du passé', 0, 200],
        ['Concordance des temps', 1, 200]
      ]],
      [course2Id, 'Module 2 — Expression', 1, 15, [
        ['Débat et argumentation', 0, 200]
      ]],
      [course3Id, 'Module 1 — Business essentials', 0, 10, [
        ['Réunions en anglais', 0, 250],
        ['Emails professionnels', 1, 200]
      ]],
      [course3Id, 'Module 2 — Negotiation', 1, 10, [
        ['Négociation', 0, 250]
      ]]
    ];

    const moduleIdByKey = {};
    const submoduleIdsByModule = {};
    for (const [courseId, name, position, discount, subs] of programme) {
      const moduleId = await insertIfMissing('course_modules', {
        course_id: courseId, name, position, discount_percent: discount, status: 'active'
      }, { course_id: courseId, name });
      moduleIdByKey[`${courseId}:${name}`] = moduleId;
      submoduleIdsByModule[moduleId] = [];
      for (const [subName, subPosition, price] of subs) {
        const subId = await insertIfMissing('module_submodules', {
          module_id: moduleId, name: subName, position: subPosition,
          price_millimes: price * 1000, status: 'active'
        }, { module_id: moduleId, name: subName });
        submoduleIdsByModule[moduleId].push(subId);
      }
    }

    // ------------------------------------------------------------------
    // Sample ledger: register demo students to a module, snapshotting the
    // catalogue price into charges. One charge is marked settled so the UI can
    // show both the paid and unpaid states. P2 replaces this direct write with
    // real payments and allocations, which become the single source of truth.
    // ------------------------------------------------------------------
    async function registerModule(enrollmentId, courseId, moduleName) {
      const moduleId = moduleIdByKey[`${courseId}:${moduleName}`];
      if (!moduleId) return [];
      const enrollmentModuleId = await insertIfMissing('enrollment_modules', {
        enrollment_id: enrollmentId, module_id: moduleId,
        discount_percent: 0, status: 'active'
      }, { enrollment_id: enrollmentId, module_id: moduleId });

      const charges = [];
      for (const submoduleId of submoduleIdsByModule[moduleId] || []) {
        const sub = await get('SELECT price_millimes FROM module_submodules WHERE id = ?', [submoduleId]);
        const priceMillimes = sub ? sub.price_millimes : 0;
        const chargeId = await insertIfMissing('enrollment_submodules', {
          enrollment_module_id: enrollmentModuleId, submodule_id: submoduleId,
          price_millimes: priceMillimes, discount_millimes: 0,
          amount_paid_millimes: 0, balance_millimes: priceMillimes, status: 'unpaid'
        }, { enrollment_module_id: enrollmentModuleId, submodule_id: submoduleId });
        charges.push({ chargeId, priceMillimes });
      }
      return charges;
    }

    const sophieCharges = await registerModule(enrollment2Id, course1Id, 'Module 1 — Fondations');
    const sophieChargeId = sophieCharges[0] ? sophieCharges[0].chargeId : null;
    if (sophieChargeId) {
      // Settle the first charge through the real payment path so the demo ledger
      // and its payments list agree. A charge left "paid" by an older seed has
      // no allocation, so repair it first; a charge already settled through a
      // payment is left untouched (idempotent re-run).
      const charge = await get(
        `SELECT es.status,
                (SELECT COUNT(*) FROM payment_allocations pa WHERE pa.enrollment_submodule_id = es.id) AS allocations
         FROM enrollment_submodules es WHERE es.id = ?`,
        [sophieChargeId]
      );
      if (charge && charge.status === 'paid' && Number(charge.allocations) === 0) {
        await run(
          `UPDATE enrollment_submodules
           SET amount_paid_millimes = 0, balance_millimes = price_millimes,
               discount_millimes = 0, status = 'unpaid'
           WHERE id = ?`,
          [sophieChargeId]
        );
      }
      const settled = await get('SELECT status FROM enrollment_submodules WHERE id = ?', [sophieChargeId]);
      if (settled && settled.status === 'unpaid') {
        await paymentService.recordPayment(student2UserId, {
          method: 'cash',
          note: 'Règlement de démonstration',
          items: [{ enrollmentSubmoduleId: sophieChargeId }]
        }, adminId);
      }
    }
    await registerModule(enrollment1Id, course2Id, 'Module 1 — Grammaire avancée');
    await registerModule(enrollment3Id, course3Id, 'Module 1 — Business essentials');
    await registerModule(enrollment3Id, course3Id, 'Module 2 — Negotiation');

    // ------------------------------------------------------------------
    // Student language profiles (demo: Pierre FR B1, Sophie EN A2, Lucas DE B2)
    // Levels are resolved by code so fresh and migrated databases agree.
    // ------------------------------------------------------------------
    const levelIdByCode = {};
    for (const code of ['A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1']) {
      const row = await get('SELECT id FROM levels WHERE code = ?', [code]);
      if (row) levelIdByCode[code] = row.id;
    }

    const profiles = [
      // [studentId, langKey, global, listening, reading, speaking, writing, method, score]
      [student1Id, 'fr', 'B1.1', 'B1.1', 'B1.1', 'A2.2', 'B1.1', 'placement_test', 68],
      [student2Id, 'en', 'A2.1', 'A2.2', 'A2.1', 'A2.1', 'A2.1', 'exam', 55],
      [student3Id, 'de', 'B2.1', 'B2.1', 'B2.1', 'B2.1', 'B1.2', 'teacher_assessment', 82]
    ];

    for (const [sId, langKey, global, listening, reading, speaking, writing, method, score] of profiles) {
      if (!levelIdByCode[global]) continue;
      const profileId = await insertIfMissing('student_languages', {
        student_id: sId, language_id: langIds[langKey],
        global_level_id: levelIdByCode[global],
        listening_level_id: levelIdByCode[listening] ?? null,
        reading_level_id: levelIdByCode[reading] ?? null,
        speaking_level_id: levelIdByCode[speaking] ?? null,
        writing_level_id: levelIdByCode[writing] ?? null,
        assessment_method: method, assessment_score: score,
        assessed_at: '2026-10-05'
      }, { student_id: sId, language_id: langIds[langKey] });

      await insertIfMissing('level_history', {
        student_language_id: profileId, old_level_id: null,
        new_level_id: levelIdByCode[global], changed_by: adminId,
        reason: 'Initial assessment', method, score
      }, { student_language_id: profileId, new_level_id: levelIdByCode[global] });
    }

    // ------------------------------------------------------------------
    // Attendance
    // ------------------------------------------------------------------
    const attendance = [
      [student2Id, course1Id, session1Id, '2024-01-15', 'present'],
      [student2Id, course1Id, session2Id, '2024-01-17', 'present'],
      [student1Id, course2Id, session3Id, '2024-01-16', 'late']
    ];

    for (const [sId, cId, sessId, date, status] of attendance) {
      await insertIfMissing('attendance', {
        student_id: sId, course_id: cId, session_id: sessId, date, status
      }, { student_id: sId, course_id: cId, date });
    }

    // ------------------------------------------------------------------
    // Grades
    // ------------------------------------------------------------------
    const grades = [
      [student1Id, course2Id, skillIds.listening, 'exam', 85],
      [student1Id, course2Id, skillIds.speaking, 'quiz', 78],
      [student2Id, course1Id, skillIds.reading, 'assignment', 92]
    ];

    for (const [sId, cId, skillId, type, score] of grades) {
      await insertIfMissing('grades', {
        student_id: sId, course_id: cId, skill_id: skillId,
        assessment_type: type, score, max_score: 100
      }, { student_id: sId, course_id: cId, assessment_type: type });
    }

    // ------------------------------------------------------------------
    // Certificate
    // ------------------------------------------------------------------
    await insertIfMissing('certificates', {
      certificate_number: 'CERT-2024-001', student_id: student1Id, course_id: course2Id,
      level: 'B1', score: 85, status: 'active',
      verification_url: '/verify/certificate/CERT-2024-001'
    }, { certificate_number: 'CERT-2024-001' });

    // ------------------------------------------------------------------
    // Announcements
    // ------------------------------------------------------------------
    await insertIfMissing('announcements', {
      title: 'Bienvenue au Centre de Langue',
      content: "Nous sommes ravis de vous accueillir dans notre centre. N'hésitez pas à contacter nos professeurs pour toute question.",
      author_id: adminId, target_audience: 'all', priority: 'normal'
    }, { title: 'Bienvenue au Centre de Langue' });

    await insertIfMissing('announcements', {
      title: 'Nouveaux cours de français',
      content: 'De nouveaux cours de français débutant seront disponibles à partir de janvier. Inscriptions ouvertes!',
      author_id: adminId, target_audience: 'students', priority: 'high'
    }, { title: 'Nouveaux cours de français' });

    // ------------------------------------------------------------------
    // Notifications
    // ------------------------------------------------------------------
    await insertIfMissing('notifications', {
      user_id: student1UserId, title: 'Bienvenue',
      message: 'Bienvenue sur la plateforme du Centre de Langue!', type: 'success'
    }, { user_id: student1UserId, title: 'Bienvenue' });

    await insertIfMissing('notifications', {
      user_id: student2UserId, title: 'Nouveau cours',
      message: 'Un nouveau cours de français débutant est disponible.', type: 'info'
    }, { user_id: student2UserId, title: 'Nouveau cours' });

    // ------------------------------------------------------------------
    // Audit logs
    // ------------------------------------------------------------------
    await insertIfMissing('audit_logs', {
      user_id: adminId, action: 'CREATE', resource: 'users', resource_id: adminId,
      new_value: JSON.stringify({ email: 'admin@center.com', role: 'admin' })
    }, { user_id: adminId, action: 'CREATE', resource: 'users', resource_id: adminId });

    await insertIfMissing('audit_logs', {
      user_id: adminId, action: 'CREATE', resource: 'courses', resource_id: course1Id,
      new_value: JSON.stringify({ name: 'Français Débutant', language: 'Français' })
    }, { user_id: adminId, action: 'CREATE', resource: 'courses', resource_id: course1Id });

    // ------------------------------------------------------------------
    // Branch
    // ------------------------------------------------------------------
    await insertIfMissing('branches', {
      name: 'Centre Principal', address: '123 Rue de la Langue, Paris',
      phone: '+33123456789', email: 'contact@center.com'
    }, { name: 'Centre Principal' });

    console.log('\n✅ Database seeded successfully!\n');
    console.log('📧 Demo accounts:');
    console.log('   Admin:    admin@center.com / admin123');
    console.log('   Teacher:  teacher@center.com / teacher123');
    console.log('   Student:  student@center.com / student123\n');
    console.log('📊 Seeded: 5 languages, 6 CEFR levels, 12 sub-levels, 6 skills, 3 courses,');
    console.log('          6 modules, 10 submodules, 3 groups, 3 sessions, 3 enrollments,');
    console.log('          4 module registrations (1 réglée, 1 paiement), 3 attendance, 3 grades, 1 certificate,');
    console.log('          2 announcements, 2 notifications, 2 audit logs, 1 branch\n');

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    if (process.env.DEBUG_SEED) console.error(error.stack);
    db.close();
    process.exit(1);
  }
}

seed();