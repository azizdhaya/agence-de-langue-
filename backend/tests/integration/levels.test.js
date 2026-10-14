const request = require('supertest');
const app = require('../../src/app');

describe('Levels Endpoints', () => {
  let authToken;
  // Unique per run so repeated test executions don't violate UNIQUE(code)
  const uniqueSuffix = Date.now().toString(36);

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@center.com',
        password: 'admin123'
      });
    authToken = loginRes.body.token;
  });

  describe('GET /api/levels', () => {
    test('should get all levels', async () => {
      const res = await request(app)
        .get('/api/levels')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should return seeded CEFR levels', async () => {
      const res = await request(app)
        .get('/api/levels')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/levels/:id', () => {
    test('should get level by id', async () => {
      const res = await request(app)
        .get('/api/levels/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('code');
      expect(res.body.data).toHaveProperty('name');
    });
  });

  describe('POST /api/levels', () => {
    test('should create a new level', async () => {
      const res = await request(app)
        .post('/api/levels')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `A1-test-${uniqueSuffix}`,
          name: 'Test Level',
          description: 'Test level description',
          orderIndex: 99,
          durationHours: 60
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    });
  });
});
