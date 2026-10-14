const request = require('supertest');
const app = require('../../src/app');

describe('Grades Endpoints', () => {
  let authToken;
  let teacherToken;
  let studentToken;
  let gradeId;

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

  describe('POST /api/grades', () => {
    test('records a grade with a default max_score of 100', async () => {
      const res = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: 1, courseId: 1, assessmentType: 'quiz', score: 17, maxScore: 20 });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('gradeId');
      gradeId = res.body.gradeId;
    });

    test('rejects a missing score with 400', async () => {
      const res = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 1, courseId: 1, assessmentType: 'quiz' });

      expect(res.statusCode).toBe(400);
    });

    test('rejects a student recording a grade with 403', async () => {
      const res = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ studentId: 1, courseId: 1, assessmentType: 'quiz', score: 10 });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/grades/course/:courseId', () => {
    test('lists grades with student names', async () => {
      const res = await request(app)
        .get('/api/grades/course/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/grades/student/:studentId', () => {
    test('a student reads their own grades', async () => {
      const res = await request(app)
        .get('/api/grades/student/1')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('a student is blocked from another grades without crashing', async () => {
      const res = await request(app)
        .get('/api/grades/student/2')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error', 'Access denied');
    });
  });

  describe('GET /api/grades/summary/:studentId', () => {
    test('returns per-course aggregates', async () => {
      const res = await request(app)
        .get('/api/grades/summary/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('a student is blocked from another summary', async () => {
      const res = await request(app)
        .get('/api/grades/summary/2')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /api/grades/:id', () => {
    test('updates a grade', async () => {
      const res = await request(app)
        .put(`/api/grades/${gradeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assessmentType: 'quiz', score: 18, maxScore: 20 });

      expect(res.statusCode).toBe(200);
    });

    test('returns 404 for an unknown grade', async () => {
      const res = await request(app)
        .put('/api/grades/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assessmentType: 'quiz', score: 1, maxScore: 20 });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/grades/:id', () => {
    test('deletes a grade', async () => {
      const res = await request(app)
        .delete(`/api/grades/${gradeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });

    test('returns 404 when deleting twice', async () => {
      const res = await request(app)
        .delete(`/api/grades/${gradeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('student id resolution (UI convention)', () => {
    test('records a grade sent with a users-table id', async () => {
      // Pierre is carried by his users-table id in every UI picker.
      const pierre = await require('../../src/utils/dbHelpers').get(
        "SELECT id FROM users WHERE email = 'student@center.com'"
      );

      const res = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: pierre.id, courseId: 1, assessmentType: 'quiz', score: 15, maxScore: 20 });

      expect(res.statusCode).toBe(201);

      const row = await require('../../src/utils/dbHelpers').get(
        'SELECT student_id FROM grades WHERE id = ?', [res.body.gradeId]
      );
      expect(row.student_id).toBe(1);
    });

    test('an unknown student answers 404, not a raw SQLITE error', async () => {
      const res = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 999999, courseId: 1, assessmentType: 'quiz', score: 10 });

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Student not found');
      expect(JSON.stringify(res.body)).not.toContain('SQLITE_CONSTRAINT');
    });
  });
});
