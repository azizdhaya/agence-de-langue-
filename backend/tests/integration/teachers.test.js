const request = require('supertest');
const app = require('../../src/app');

describe('Teachers Endpoints', () => {
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

  const email = () => `newteacher${Date.now()}${Math.floor(Math.random() * 1000)}@center.com`;

  describe('GET /api/teachers', () => {
    test('should get all teachers', async () => {
      const res = await request(app)
        .get('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/teachers', () => {
    test('should create a teacher with a login account', async () => {
      const res = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Sonia', lastName: 'Test', email: email(),
          password: 'secret123', specialization: 'Anglais'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
    });

    test('the new teacher can log in', async () => {
      const address = email();
      await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Mehdi', lastName: 'Test', email: address, password: 'secret123' });

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: address, password: 'secret123' });

      expect(login.statusCode).toBe(200);
      expect(login.body).toHaveProperty('token');
    });

    test('should refuse a duplicate email with 409', async () => {
      const address = email();
      await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'A', lastName: 'B', email: address, password: 'secret123' });

      const res = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'C', lastName: 'D', email: address, password: 'secret123' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('should require a password', async () => {
      const res = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Sans', lastName: 'Motdepasse', email: email() });

      expect(res.statusCode).toBe(400);
    });

    test('should delete a teacher without assignments', async () => {
      const created = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Temp', lastName: 'Erase', email: email(), password: 'secret123' });

      const res = await request(app)
        .delete(`/api/teachers/${created.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });

    test('should refuse to delete a teacher with courses', async () => {
      // Seeded teacher 1 (Marie Dupont) owns courses.
      const list = await request(app)
        .get('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`);
      const marie = list.body.find((t) => t.email === 'teacher@center.com');

      const res = await request(app)
        .delete(`/api/teachers/${marie.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('TEACHER_IN_USE');
    });

    test('should require admin role', async () => {
      const teacherLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'teacher@center.com', password: 'teacher123' });

      const res = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${teacherLogin.body.token}`)
        .send({ firstName: 'X', lastName: 'Y', email: email(), password: 'secret123' });

      expect(res.statusCode).toBe(403);
    });
  });
});
