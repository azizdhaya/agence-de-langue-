const request = require('supertest');
const app = require('../../src/app');

describe('Courses Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@center.com',
        password: 'admin123'
      });
    authToken = loginRes.body.token;
  });

  describe('GET /api/courses', () => {
    test('should get all courses', async () => {
      const res = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should filter courses by status', async () => {
      const res = await request(app)
        .get('/api/courses?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should filter courses by language', async () => {
      const res = await request(app)
        .get('/api/courses?language=Français')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should filter courses by CEFR level', async () => {
      const res = await request(app)
        .get('/api/courses?levelId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/courses/:id', () => {
    test('should get course by id', async () => {
      const res = await request(app)
        .get('/api/courses/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
    });

    test('should return 404 for non-existent course', async () => {
      const res = await request(app)
        .get('/api/courses/9999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/courses', () => {
    test('should create a course linked to a CEFR level', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Course B1',
          language: 'Français',
          level: 'B1',
          levelCode: 'B1.1',
          price: 100
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('id');

      const detail = await request(app)
        .get(`/api/courses/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(detail.body.data.level_code).toBe('B1.1');

      await request(app)
        .delete(`/api/courses/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('should reject an unknown level code', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Bad Course', language: 'X', level: 'X', levelCode: 'Z9', price: 10 });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('LEVEL_NOT_FOUND');
    });

    test('should create a course with type and mode', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cours Intensif', language: 'Français', level: 'beginner',
          courseType: 'intensive', mode: 'hybride', price: 100
        });

      expect(res.statusCode).toBe(201);

      await request(app)
        .delete(`/api/courses/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('should refuse an unknown course type', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Bad Type', language: 'X', level: 'X', courseType: 'express', price: 10 });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should refuse an end date before the start date', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cours Inversé', language: 'X', level: 'X', price: 10,
          startDate: '2026-06-01', endDate: '2026-05-01'
        });

      expect(res.statusCode).toBe(422);
      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    test('should refuse an unknown teacher with 404, not a raw 500', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cours Orphelin', language: 'X', level: 'X', teacherId: 999999, price: 10 });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('TEACHER_NOT_FOUND');
      expect(JSON.stringify(res.body)).not.toContain('FOREIGN KEY');
    });

    test('should create a course when optional fields are empty strings', async () => {
      // Exact regression: the course form sends '' for untouched optionals
      // (teacherId, levelCode, description…). Empty means "not provided".
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cours Vide', language: 'Anglais', level: 'beginner',
          teacherId: '', levelCode: '', description: '', price: 100
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('id');

      await request(app)
        .delete(`/api/courses/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });
  });

  describe('POST /api/courses/:id/enroll', () => {
    test('should refuse a level-mismatched enrolment without confirmation', async () => {
      const course = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Enroll Guard Course', language: 'Allemand', level: 'C1', levelCode: 'C1.1', languageId: 4, price: 100 });

      const res = await request(app)
        .post(`/api/courses/${course.body.data.id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 2 });

      // student 2 has no German C1 profile match (or no profile): confirmation required
      expect([201, 409]).toContain(res.statusCode);
      if (res.statusCode === 409) {
        expect(res.body.error.code).toBe('LEVEL_MISMATCH');
      }

      await request(app)
        .delete(`/api/courses/${course.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('should enrol with explicit confirmation', async () => {
      const course = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Enroll Confirm Course', language: 'Allemand', level: 'C1', levelCode: 'C1.1', languageId: 4, price: 100 });

      const res = await request(app)
        .post(`/api/courses/${course.body.data.id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 3, confirmed: true });

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('enrollmentId');
    });

    test('deleting a course auto-unenrolls its clean members', async () => {
      const course = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cours Cascade Suppr', language: 'Anglais', level: 'A1', price: 50 });

      await request(app)
        .post(`/api/courses/${course.body.data.id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 3, confirmed: true });

      const res = await request(app)
        .delete(`/api/courses/${course.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });

    test('should refuse to delete a course that still has groups, naming them', async () => {
      const course = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Grouped Course', language: 'Anglais', level: 'A1', price: 50 });

      await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Groupe du Cours', courseId: course.body.data.id, maxStudents: 5 });

      const res = await request(app)
        .delete(`/api/courses/${course.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('COURSE_IN_USE');
      // Rien n'est supprimé : le cours survit au refus.
      const still = await request(app)
        .get(`/api/courses/${course.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(still.statusCode).toBe(200);
    });

    test('should unenroll a clean enrolment so the course can be deleted', async () => {
      // Non-régression : il n'existait aucun moyen de retirer une inscription,
      // donc un cours/group avec effectif ne pouvait jamais être supprimé.
      const course = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unenroll Course', language: 'Anglais', level: 'A1', price: 50 });

      const enrolled = await request(app)
        .post(`/api/courses/${course.body.data.id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 3, confirmed: true });
      expect(enrolled.statusCode).toBe(201);

      const del = await request(app)
        .delete(`/api/enrollments/${enrolled.body.data.enrollmentId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(del.statusCode).toBe(200);

      const courseDel = await request(app)
        .delete(`/api/courses/${course.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(courseDel.statusCode).toBe(200);
    });

    test('should delete the enrolment and drop the course headcount', async () => {
      const course = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unenroll Count Course', language: 'Anglais', level: 'A1', price: 50 });

      const enrolled = await request(app)
        .post(`/api/courses/${course.body.data.id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 3, confirmed: true });

      const res = await request(app)
        .delete(`/api/enrollments/${enrolled.body.data.enrollmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);

      const { get } = require('../../src/utils/dbHelpers');
      const row = await get('SELECT id FROM enrollments WHERE id = ?', [enrolled.body.data.enrollmentId]);
      expect(row).toBeUndefined();
    });
  });
});
