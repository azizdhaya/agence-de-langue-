const request = require('supertest');
const app = require('../../src/app');

describe('Students Endpoints', () => {
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

  describe('GET /api/students', () => {
    test('should get all students', async () => {
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('should filter students by status', async () => {
      const res = await request(app)
        .get('/api/students?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('should search students', async () => {
      const res = await request(app)
        .get('/api/students?search=Pierre')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/students/:id', () => {
    test('should get student by id', async () => {
      const res = await request(app)
        .get('/api/students/4')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('first_name');
    });

    test('should return 404 for non-existent student', async () => {
      const res = await request(app)
        .get('/api/students/9999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/students', () => {
    const email = () => `newstudent${Date.now()}@center.com`;

    test('should create a student with a login account', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Nadia', lastName: 'Test', email: email(), password: 'secret123' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
    });

    test('the new student can log in', async () => {
      const address = email();
      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Karim', lastName: 'Test', email: address, password: 'secret123' });

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: address, password: 'secret123' });

      expect(login.statusCode).toBe(200);
      expect(login.body).toHaveProperty('token');
    });

    test('should refuse a duplicate email with 409', async () => {
      const address = email();
      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'A', lastName: 'B', email: address, password: 'secret123' });

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'C', lastName: 'D', email: address, password: 'secret123' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('should require a password', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Sans', lastName: 'Motdepasse', email: email() });

      expect(res.statusCode).toBe(400);
    });

    test('should refuse to delete a student with enrolments', async () => {
      // Pierre (user id 4) has enrolments behind him.
      const res = await request(app)
        .delete('/api/students/4')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('STUDENT_IN_USE');
    });
  });
});
