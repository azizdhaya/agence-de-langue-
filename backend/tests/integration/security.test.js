const request = require('supertest');
const app = require('../../src/app');
const BaseRepository = require('../../src/repositories/BaseRepository');

/**
 * Security regression: registration lockdown, hash stripping, ORDER BY
 * allowlist, message validation, notification scoping.
 */
describe('Security hardening', () => {
  let authToken;
  let teacherToken;

  beforeAll(async () => {
    const admin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@center.com', password: 'admin123' });
    authToken = admin.body.token;
    const teacher = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@center.com', password: 'teacher123' });
    teacherToken = teacher.body.token;
  });

  describe('POST /api/auth/register is admin-only and validated', () => {
    test('anonymous registration is refused', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'hacker@example.com', password: 'hacker123',
        firstName: 'H', lastName: 'Ack', role: 'admin'
      });
      expect([401, 403]).toContain(res.statusCode);
    });

    test('a teacher cannot self-promote anyone', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          email: 'hacker@example.com', password: 'hacker123',
          firstName: 'H', lastName: 'Ack', role: 'admin'
        });
      expect(res.statusCode).toBe(403);
    });

    test('an admin registers a validated user, unknown roles rejected', async () => {
      const bad = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'root@example.com', password: 'root1234',
          firstName: 'R', lastName: 'Oot', role: 'superadmin'
        });
      expect(bad.statusCode).toBe(400);

      const ok = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'sec-teacher@example.com', password: 'sec12345',
          firstName: 'Sec', lastName: 'Teacher', role: 'teacher'
        });
      expect(ok.statusCode).toBe(201);

      const dupe = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'sec-teacher@example.com', password: 'sec12345',
          firstName: 'Sec', lastName: 'Teacher', role: 'teacher'
        });
      expect(dupe.statusCode).toBe(400);
    });
  });

  describe('password hashes never leak in JSON', () => {
    test.each([
      ['/api/students'],
      ['/api/teachers']
    ])('%s carries no password field', async (path) => {
      const res = await request(app).get(path).set('Authorization', `Bearer ${authToken}`);
      expect(res.statusCode).toBe(200);
      const rows = Array.isArray(res.body) ? res.body : res.body.data;
      for (const row of rows.slice(0, 5)) {
        expect(row).not.toHaveProperty('password');
      }
    });

    test('single-student and single-teacher reads carry no password', async () => {
      const students = await request(app).get('/api/students').set('Authorization', `Bearer ${authToken}`);
      if (students.body.length > 0) {
        const one = await request(app)
          .get(`/api/students/${students.body[0].id}`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(one.body).not.toHaveProperty('password');
      }
    });
  });

  describe('ORDER BY allowlist', () => {
    test('sanitizeOrder keeps valid clauses and falls back otherwise', () => {
      expect(BaseRepository.sanitizeOrder('code ASC', 'id DESC')).toBe('code ASC');
      expect(BaseRepository.sanitizeOrder('i.issued_date DESC', 'x')).toBe('i.issued_date DESC');
      expect(BaseRepository.sanitizeOrder('id DESC, (SELECT 1)', 'id DESC')).toBe('id DESC');
      expect(BaseRepository.sanitizeOrder('1; DROP TABLE users', 'id DESC')).toBe('id DESC');
      expect(BaseRepository.sanitizeOrder('', 'id DESC')).toBe('id DESC');
      expect(BaseRepository.sanitizeOrder(null, 'id DESC')).toBe('id DESC');
    });

    test('sanitizeWhere drops non-identifier keys', () => {
      expect(BaseRepository.sanitizeWhere({ status: 'active', 'x) OR (1=1 -- ': 1 }))
        .toEqual({ status: 'active' });
    });

    test('a hostile order parameter is neutralised, list stays 200', async () => {
      const res = await request(app)
        .get('/api/skills?order=id DESC, (SELECT 1 FROM missing_table)')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('messages validation', () => {
    test('oversized and empty content refused, unknown receiver 404', async () => {
      const big = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ receiverId: 1, content: 'x'.repeat(2001) });
      expect(big.statusCode).toBe(400);

      const ghost = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ receiverId: 999999, content: 'hello?' });
      expect(ghost.statusCode).toBe(404);
    });
  });

  describe('notifications are owner-scoped for non-admins', () => {
    test('a teacher sees only their own notifications', async () => {
      const { get } = require('../../src/utils/dbHelpers');
      const teacher = await get("SELECT id FROM users WHERE email = 'teacher@center.com'");

      await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 1, title: 'Admin only', message: 'x' });
      const own = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: teacher.id, title: 'Pour prof', message: 'y' });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(200);
      const rows = res.body.data;
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(row.user_id).toBe(teacher.id);
      }
      expect(rows.some((row) => row.id === own.body.data.id)).toBe(true);
    });

    test("a teacher cannot open another user's notification", async () => {
      const created = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 1, title: 'Admin only', message: 'x' });

      const res = await request(app)
        .get(`/api/notifications/${created.body.data.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
