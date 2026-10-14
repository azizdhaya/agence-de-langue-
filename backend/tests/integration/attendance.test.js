const request = require('supertest');
const app = require('../../src/app');

describe('Attendance Endpoints', () => {
  let authToken;
  let teacherToken;
  let studentToken;

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

  describe('POST /api/attendance', () => {
    test('records a single attendance row', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 1, courseId: 1, date: '2026-10-07', status: 'present' });

      expect(res.statusCode).toBe(201);
    });

    test('rejects a missing status with 400', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 1, courseId: 1, date: '2026-10-07' });

      expect(res.statusCode).toBe(400);
    });

    test('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .send({ studentId: 1, courseId: 1, date: '2026-10-07', status: 'present' });

      expect(res.statusCode).toBe(401);
    });

    test('rejects a student recording attendance with 403', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ studentId: 1, courseId: 1, date: '2026-10-07', status: 'present' });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/attendance/bulk', () => {
    test('records several rows at once', async () => {
      const res = await request(app)
        .post('/api/attendance/bulk')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId: 1,
          date: '2026-10-07',
          attendanceData: [
            { studentId: 1, status: 'present' },
            { studentId: 2, status: 'late', notes: '10 min' }
          ]
        });

      expect(res.statusCode).toBe(200);
    });

    test('rejects a non-array payload with 400', async () => {
      const res = await request(app)
        .post('/api/attendance/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ courseId: 1, date: '2026-10-07', attendanceData: 'nope' });

      expect(res.statusCode).toBe(400);
    });

    test('rejects rows missing studentId or status with 400', async () => {
      const res = await request(app)
        .post('/api/attendance/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          courseId: 1,
          date: '2026-10-07',
          attendanceData: [
            { studentId: 1, status: 'present' },
            { studentId: 2 }
          ]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/indexes: 1/);
    });
  });

  describe('GET /api/attendance/course/:courseId', () => {
    test('lists rows, optionally filtered by date', async () => {
      const res = await request(app)
        .get('/api/attendance/course/1?date=2026-10-07')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/attendance/student/:studentId', () => {
    test('a student reads their own summary', async () => {
      const res = await request(app)
        .get('/api/attendance/student/1')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('a student is blocked from another summary without crashing', async () => {
      // Non-régression : le 403 partait en parallèle de la requête, ce qui
      // plantait le serveur (ERR_HTTP_HEADERS_SENT).
      const res = await request(app)
        .get('/api/attendance/student/2')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error', 'Access denied');
    });
  });

  describe('student id resolution (UI convention)', () => {
    test('bulk records rows sent with users-table ids', async () => {
      const { get } = require('../../src/utils/dbHelpers');
      const pierre = await get("SELECT id FROM users WHERE email = 'student@center.com'");

      const res = await request(app)
        .post('/api/attendance/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          courseId: 1,
          date: '2026-10-08',
          attendanceData: [{ studentId: pierre.id, status: 'present' }]
        });

      expect(res.statusCode).toBe(200);

      const row = await get(
        'SELECT student_id FROM attendance WHERE course_id = 1 AND date = ?',
        ['2026-10-08']
      );
      expect(row.student_id).toBe(1);
    });

    test('an unknown student aborts the batch with 404 before writing', async () => {
      const { get } = require('../../src/utils/dbHelpers');
      const before = await get('SELECT COUNT(*) AS n FROM attendance WHERE date = ?', ['2026-10-09']);

      const res = await request(app)
        .post('/api/attendance/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          courseId: 1,
          date: '2026-10-09',
          attendanceData: [{ studentId: 999999, status: 'present' }]
        });

      expect(res.statusCode).toBe(404);

      const after = await get('SELECT COUNT(*) AS n FROM attendance WHERE date = ?', ['2026-10-09']);
      expect(after.n).toBe(before.n);
    });
  });
});
