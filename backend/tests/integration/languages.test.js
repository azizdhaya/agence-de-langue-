const request = require('supertest');
const app = require('../../src/app');

describe('Languages Endpoints', () => {
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

  describe('GET /api/languages', () => {
    test('should get all languages', async () => {
      const res = await request(app)
        .get('/api/languages')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should return seeded languages', async () => {
      const res = await request(app)
        .get('/api/languages')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/languages/:id', () => {
    test('should get language by id', async () => {
      const res = await request(app)
        .get('/api/languages/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('code');
      expect(res.body.data).toHaveProperty('name');
    });

    test('should return 404 for non-existent language', async () => {
      const res = await request(app)
        .get('/api/languages/9999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/languages', () => {
    test('should create a new language', async () => {
      const res = await request(app)
        .post('/api/languages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `it-${uniqueSuffix}`,
          name: 'Italien',
          flag: '🇮🇹'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.code).toBe(`it-${uniqueSuffix}`);
    });

    test('should fail without required fields', async () => {
      const res = await request(app)
        .post('/api/languages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Italien'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/languages/:id', () => {
    test('should update a language', async () => {
      const res = await request(app)
        .put('/api/languages/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Français (France)'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('DELETE /api/languages/:id', () => {
    test('should delete a language', async () => {
      // First create a language to delete
      const createRes = await request(app)
        .post('/api/languages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `test-${uniqueSuffix}`,
          name: 'Test Language',
          flag: '🏳️'
        });

      const languageId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/api/languages/${languageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
