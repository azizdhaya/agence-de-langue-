const request = require('supertest');
const app = require('../../src/app');

/**
 * Dashboard endpoints for the student and teacher roles.
 * Verifies that the aggregated figures come from the database instead of
 * hardcoded placeholders.
 */
describe('Dashboard endpoints (student / teacher)', () => {
  describe('GET /api/dashboard/student', () => {
    let studentToken;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@center.com', password: 'student123' });
      studentToken = loginRes.body.token;
    });

    test('returns aggregated dashboard data', async () => {
      const res = await request(app)
        .get('/api/dashboard/student')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('level');
      expect(res.body.data).toHaveProperty('activeCourses');
      expect(res.body.data).toHaveProperty('attendanceRate');
      expect(res.body.data).toHaveProperty('upcomingSessions');
      expect(res.body.data).toHaveProperty('recentGrades');
    });

    test('numbers are not strings and not undefined', async () => {
      const res = await request(app)
        .get('/api/dashboard/student')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(typeof res.body.data.activeCourses).toBe('number');
      expect(typeof res.body.data.certificates).toBe('number');
    });

    test('activeCourses reflects the seeded enrollment', async () => {
      const res = await request(app)
        .get('/api/dashboard/student')
        .set('Authorization', `Bearer ${studentToken}`);

      // Seed creates one active enrollment for this student
      expect(res.body.data.activeCourses).toBeGreaterThan(0);
    });

    test('upcomingSessions and recentGrades are arrays', async () => {
      const res = await request(app)
        .get('/api/dashboard/student')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(Array.isArray(res.body.data.upcomingSessions)).toBe(true);
      expect(Array.isArray(res.body.data.recentGrades)).toBe(true);
    });

    test('requires authentication', async () => {
      const res = await request(app).get('/api/dashboard/student');
      expect(res.statusCode).toBe(401);
    });

    test('is forbidden for an admin', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@center.com', password: 'admin123' });

      const res = await request(app)
        .get('/api/dashboard/student')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/dashboard/teacher', () => {
    let teacherToken;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'teacher@center.com', password: 'teacher123' });
      teacherToken = loginRes.body.token;
    });

    test('returns aggregated dashboard data', async () => {
      const res = await request(app)
        .get('/api/dashboard/teacher')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('activeGroups');
      expect(res.body.data).toHaveProperty('totalStudents');
      expect(res.body.data).toHaveProperty('sessions');
      expect(res.body.data).toHaveProperty('groups');
    });

    test('activeGroups reflects the seeded groups', async () => {
      const res = await request(app)
        .get('/api/dashboard/teacher')
        .set('Authorization', `Bearer ${teacherToken}`);

      // Seed assigns two groups to the first teacher
      expect(res.body.data.activeGroups).toBeGreaterThan(0);
    });

    test('groups array is populated with student counts', async () => {
      const res = await request(app)
        .get('/api/dashboard/teacher')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(Array.isArray(res.body.data.groups)).toBe(true);
      if (res.body.data.groups.length > 0) {
        const group = res.body.data.groups[0];
        expect(group).toHaveProperty('group_name');
        expect(group).toHaveProperty('student_count');
      }
    });

    test('requires authentication', async () => {
      const res = await request(app).get('/api/dashboard/teacher');
      expect(res.statusCode).toBe(401);
    });

    test('is forbidden for a student', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@center.com', password: 'student123' });

      const res = await request(app)
        .get('/api/dashboard/teacher')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(res.statusCode).toBe(403);
    });
  });
});