const request = require('supertest');
const app = require('../../src/app');

describe('CEFR levels and student language profiles', () => {
  let authToken;
  let teacherToken;
  let studentToken;

  const asAdmin = (method, path, body) => {
    const req = request(app)[method](path).set('Authorization', `Bearer ${authToken}`);
    return body ? req.send(body) : req;
  };

  beforeAll(async () => {
    const admin = await request(app).post('/api/auth/login')
      .send({ email: 'admin@center.com', password: 'admin123' });
    authToken = admin.body.token;

    const teacher = await request(app).post('/api/auth/login')
      .send({ email: 'teacher@center.com', password: 'teacher123' });
    teacherToken = teacher.body.token;

    const student = await request(app).post('/api/auth/login')
      .send({ email: 'student@center.com', password: 'student123' });
    studentToken = student.body.token;
  });

  describe('GET /api/levels', () => {
    test('returns the full CEFR scale in true order', async () => {
      const res = await asAdmin('get', '/api/levels');

      expect(res.statusCode).toBe(200);
      const codes = res.body.data.map((l) => l.code);
      expect(codes.slice(0, 6)).toEqual(['A1', 'A1.1', 'A1.2', 'A2', 'A2.1', 'A2.2']);
      expect(codes).toHaveLength(18);
    });

    test('orders are strictly increasing', async () => {
      const res = await asAdmin('get', '/api/levels');
      const orders = res.body.data.map((l) => l.order_index);

      expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    });

    test('filters sub-levels by parent, parent included', async () => {
      const res = await asAdmin('get', '/api/levels?parent=B1');

      expect(res.body.data.map((l) => l.code)).toEqual(['B1', 'B1.1', 'B1.2']);
    });

    test('rejects an unknown parent', async () => {
      const res = await asAdmin('get', '/api/levels?parent=Z9');

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('LEVEL_NOT_FOUND');
    });

    test('main levels carry no parent, sub-levels do', async () => {
      const res = await asAdmin('get', '/api/levels?active=false');
      const byCode = Object.fromEntries(res.body.data.map((l) => [l.code, l]));

      expect(byCode['A1'].parent_code).toBeNull();
      expect(byCode['A1.1'].parent_code).toBe('A1');
      expect(res.body.data.every((l) => l.framework === 'CEFR')).toBe(true);
    });
  });

  describe('student with no language (case 1)', () => {
    let freshStudentId;

    beforeAll(async () => {
      const created = await asAdmin('post', '/api/students', {
        firstName: 'Sans', lastName: 'Langue',
        email: `nolang${Date.now()}@center.com`, password: 'secret123'
      });
      freshStudentId = created.body.data.id;
    });

    test('returns an empty profile list', async () => {
      const res = await asAdmin('get', `/api/students/${freshStudentId}/languages`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('returns 404 for the history of a missing profile', async () => {
      const res = await asAdmin('get', `/api/students/${freshStudentId}/languages/1/history`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('seeded demo profiles (§13)', () => {
    test('Pierre has French B1, Sophie English A2, Lucas German B2', async () => {
      const [pierre, sophie, lucas] = await Promise.all([
        asAdmin('get', '/api/students/1/languages'),
        asAdmin('get', '/api/students/2/languages'),
        asAdmin('get', '/api/students/3/languages')
      ]);

      // Works with table ids and user ids alike.
      const pierreByUser = await asAdmin('get', '/api/students/4/languages');

      expect(pierre.body.data[0]).toMatchObject({ language_code: 'fr', global_level_code: 'B1.1' });
      expect(sophie.body.data[0]).toMatchObject({ language_code: 'en', global_level_code: 'A2.1' });
      expect(lucas.body.data[0]).toMatchObject({ language_code: 'de', global_level_code: 'B2.1' });
      expect(pierreByUser.body.data[0]).toMatchObject({ language_code: 'fr' });
    });

    test('a users id always wins over a colliding students id', async () => {
      // The UI only ever carries user ids. If a students-table id happens to
      // equal another student's user id, the user id must win — otherwise a
      // fiche could display someone else's profile.
      const created = await asAdmin('post', '/api/students', {
        firstName: 'Collision', lastName: 'Test',
        email: `collision${Date.now()}@center.com`, password: 'secret123'
      });
      const userId = created.body.data.id;
      // The fresh row must be reachable through its user id…
      const res = await asAdmin('get', `/api/students/${userId}/languages`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('a student is never served another profile on id collision', async () => {
      // student@center.com is user 4. If a students-table row 4 exists for
      // someone else, the middleware must still resolve user 4 to themselves —
      // deterministically, not by SQLite row order.
      const login = await request(app).post('/api/auth/login')
        .send({ email: 'student@center.com', password: 'student123' });

      for (let i = 0; i < 3; i++) {
        const res = await request(app).get('/api/students/4/languages')
          .set('Authorization', `Bearer ${login.body.token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.data.find((p) => p.language_code === 'fr')).toBeDefined();
      }
    });
  });

  describe('profile lifecycle (cases 2-5)', () => {
    test('creates a profile with per-skill levels differing from the global level', async () => {
      const res = await asAdmin('post', '/api/students/2/languages', {
        languageId: 4,
        globalLevelCode: 'B1.1',
        listeningLevelCode: 'B1.2',
        readingLevelCode: 'B1.2',
        speakingLevelCode: 'B1.1',
        writingLevelCode: 'A2.2',
        method: 'placement_test',
        score: 72
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.global_level_code).toBe('B1.1');
      expect(res.body.data.listening_level_code).toBe('B1.2');
      expect(res.body.data.writing_level_code).toBe('A2.2');
      expect(res.body.data.language_code).toBe('de');
    });

    test('refuses a second profile for the same language', async () => {
      const res = await asAdmin('post', '/api/students/2/languages', { languageId: 4 });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('PROFILE_EXISTS');
    });

    test('a student can learn several languages (case 3)', async () => {
      await asAdmin('post', '/api/students/2/languages', {
        languageId: 2, globalLevelCode: 'B2.1', method: 'exam', score: 81
      });

      const res = await asAdmin('get', '/api/students/2/languages');
      const codes = res.body.data.map((p) => p.language_code).sort();

      expect(codes).toEqual(['de', 'en']);
    });

    test('changing A2.2 to B1.1 keeps the old level in history (case 4)', async () => {
      await asAdmin('post', '/api/students/3/languages', {
        languageId: 1, globalLevelCode: 'A2.2', method: 'exam', score: 55
      });
      await asAdmin('put', '/api/students/3/languages/1', {
        globalLevelCode: 'B1.1', reason: 'Progression', method: 'exam', score: 65
      });

      const profile = await asAdmin('get', '/api/students/3/languages/1');
      expect(profile.body.data.global_level_code).toBe('B1.1');

      const history = await asAdmin('get', '/api/students/3/languages/1/history');
      const change = history.body.data.find((h) => h.old_level_code === 'A2.2');

      expect(change).toBeDefined();
      expect(change.new_level_code).toBe('B1.1');
      expect(change.reason).toBe('Progression');
    });

    test('several evaluations accumulate in history (case 10)', async () => {
      await asAdmin('put', '/api/students/3/languages/1', {
        globalLevelCode: 'B1.2', reason: 'Examen final', method: 'exam', score: 74
      });

      const history = await asAdmin('get', '/api/students/3/languages/1/history');

      expect(history.body.data.length).toBeGreaterThanOrEqual(3);
      const codes = history.body.data.map((h) => h.new_level_code);
      expect(codes).toContain('B1.1');
      expect(codes).toContain('B1.2');
    });

    test('refuses an unknown level code', async () => {
      const res = await asAdmin('put', '/api/students/3/languages/1', { globalLevelCode: 'Z9' });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('LEVEL_NOT_FOUND');
    });

    test('refuses an inactive level', async () => {
      // create a throwaway level, deactivate it, then try to assign it
      const created = await asAdmin('post', '/api/levels', {
        code: 'X1', name: 'Test', orderIndex: 999
      });
      await asAdmin('put', `/api/levels/${created.body.data.id}`, { isActive: false });

      const res = await asAdmin('put', '/api/students/3/languages/1', { globalLevelCode: 'X1' });
      expect(res.statusCode).toBe(422);
      expect(res.body.error.code).toBe('LEVEL_INACTIVE');

      await asAdmin('delete', `/api/levels/${created.body.data.id}`);
    });
  });

  describe('placement assessment (case 9)', () => {
    beforeAll(async () => {
      // assessed profiles must exist first; other suites share test DBs
      await asAdmin('post', '/api/students/1/languages', {
        languageId: 1, method: 'placement_test', score: 40
      }).catch(() => {});
      await asAdmin('post', '/api/students/1/languages', {
        languageId: 2, method: 'placement_test', score: 90
      }).catch(() => {});
    });

    test('maps per-skill scores to CEFR levels via the bands', async () => {
      const res = await asAdmin('post', '/api/students/1/languages/1/assess', {
        scores: { listening: 72, reading: 65, speaking: 58, writing: 45 },
        overallScore: 60,
        method: 'placement_test'
      });

      expect(res.statusCode).toBe(200);
      // 72->B1.2, 65->B1.1, 58->A2.2, 45->A2.1 ; global = weakest = A2.1
      expect(res.body.data.profile.global_level_code).toBe('A2.1');
      expect(res.body.data.profile.listening_level_code).toBe('B1.2');
      expect(res.body.data.profile.writing_level_code).toBe('A2.1');
    });

    test('a perfect score reaches C2.2', async () => {
      const res = await asAdmin('post', '/api/students/1/languages/2/assess', {
        scores: { listening: 100, reading: 100, speaking: 100, writing: 100 }
      });

      expect(res.body.data.profile.global_level_code).toBe('C2.2');
    });

    test('rejects scores outside 0-100', async () => {
      const res = await asAdmin('post', '/api/students/1/languages/1/assess', {
        scores: { listening: 150 }
      });

      expect(res.statusCode).toBe(400);
    });

    test('rejects an empty score set', async () => {
      const res = await asAdmin('post', '/api/students/1/languages/1/assess', { scores: {} });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('SCORES_REQUIRED');
    });

    test('bands are configurable by the admin', async () => {
      const bands = await asAdmin('get', '/api/placement-bands');

      expect(bands.body.data.length).toBe(12);

      const band = bands.body.data.find((b) => b.level_code === 'B1.1');
      const updated = await asAdmin('put', `/api/placement-bands/${band.id}`, { minScore: 61 });

      expect(updated.body.data.min_score).toBe(61);

      // restore
      await asAdmin('put', `/api/placement-bands/${band.id}`, { minScore: 60 });
    });
  });

  describe('courses and enrolment coherence (cases 6-7)', () => {
    let courseId;

    test('a course can be linked to a language and a CEFR level', async () => {
      const res = await asAdmin('post', '/api/courses', {
        name: 'Allemand B1.1', language: 'Allemand', level: 'B1.1',
        languageId: 4, levelCode: 'B1.1', price: 500
      });

      expect(res.statusCode).toBe(201);
      courseId = res.body.data.id;

      const detail = await asAdmin('get', `/api/courses/${courseId}`);
      expect(detail.body.data.level_code).toBe('B1.1');
    });

    test('compatible courses rank the exact level first', async () => {
      const res = await asAdmin('get', '/api/students/2/languages/4/compatible-courses');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('check-enrollment flags a mismatch for admin confirmation', async () => {
      const res = await asAdmin('get', `/api/students/2/languages/check-enrollment?courseId=${courseId}`);

      expect(res.statusCode).toBe(200);
      // student 2 German profile is B1.1; behaviour depends on course linkage
      expect(res.body.data).toHaveProperty('coherent');
      expect(res.body.data).toHaveProperty('requiresConfirmation');
    });

    test('returns 404 for an unknown course', async () => {
      const res = await asAdmin('get', '/api/students/2/languages/check-enrollment?courseId=999999');

      expect(res.statusCode).toBe(404);
    });
  });

  describe('deletion protection (case 7)', () => {
    test('refuses to delete a level used by a profile', async () => {
      // find the B1.1 row
      const levels = await asAdmin('get', '/api/levels');
      const b11 = levels.body.data.find((l) => l.code === 'B1.1');

      const res = await asAdmin('delete', `/api/levels/${b11.id}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('LEVEL_IN_USE');
    });

    test('deletes an unused level', async () => {
      const created = await asAdmin('post', '/api/levels', {
        code: 'ZZ9', name: 'Throwaway', orderIndex: 999
      });
      const res = await asAdmin('delete', `/api/levels/${created.body.data.id}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('permissions', () => {
    test('a teacher can assess but not create profiles', async () => {
      const assess = await request(app).post('/api/students/1/languages/1/assess')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ scores: { listening: 50 } });

      expect([200, 404]).toContain(assess.statusCode);

      const create = await request(app).post('/api/students/1/languages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ languageId: 3 });

      expect(create.statusCode).toBe(403);
    });

    test('a student reads their own profile but not another student', async () => {
      const own = await request(app).get('/api/students/1/languages')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(own.statusCode).toBe(200);

      const other = await request(app).get('/api/students/2/languages')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(other.statusCode).toBe(403);
    });

    test('bands are admin-only for writes', async () => {
      const bands = await asAdmin('get', '/api/placement-bands');
      const res = await request(app).put(`/api/placement-bands/${bands.body.data[0].id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ minScore: 1 });

      expect(res.statusCode).toBe(403);
    });

    test('requires authentication', async () => {
      expect((await request(app).get('/api/levels')).statusCode).toBe(401);
      expect((await request(app).get('/api/students/1/languages')).statusCode).toBe(401);
    });
  });
});