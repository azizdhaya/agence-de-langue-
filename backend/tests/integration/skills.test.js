const request = require('supertest');
const app = require('../../src/app');

describe('Skills Endpoints', () => {
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

  describe('GET /api/skills', () => {
    test('should get all skills', async () => {
      const res = await request(app)
        .get('/api/skills')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should return seeded skills', async () => {
      const res = await request(app)
        .get('/api/skills')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/skills/:id', () => {
    test('should get skill by id', async () => {
      const res = await request(app)
        .get('/api/skills/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('code');
      expect(res.body.data).toHaveProperty('name');
    });
  });

  describe('POST /api/skills', () => {
    test('should create a new skill', async () => {
      const res = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `test-skill-${uniqueSuffix}`,
          name: 'Test Skill',
          description: 'Test skill description'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    });
  });
});
