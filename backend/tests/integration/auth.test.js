const request = require('supertest');
const app = require('../../src/app');

describe('Auth Endpoints', () => {
  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@center.com',
          password: 'admin123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('admin@center.com');
    });

    test('should fail with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@center.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    test('should fail with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@center.com'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should get current user with valid token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@center.com',
          password: 'admin123'
        });

      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email');
    });

    test('should fail without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    test('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    test('should fail with an unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@center.com', password: 'whatever123' });

      expect(res.statusCode).toBe(401);
    });

    test('should fail with a malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Token abcdef');

      expect([401, 403]).toContain(res.statusCode);
    });

    test('should fail with an expired token', async () => {
      const jwt = require('jsonwebtoken');
      const expired = jwt.sign(
        { id: 1, email: 'admin@center.com', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expired}`);

      expect(res.statusCode).toBe(403);
    });

    test('a student cannot reach an admin-only route', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@center.com', password: 'student123' });

      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
