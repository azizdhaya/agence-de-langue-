const request = require('supertest');
const app = require('../../src/app');

describe('Certificates Endpoints', () => {
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

  describe('GET /api/certificates', () => {
    test('should get all certificates', async () => {
      const res = await request(app)
        .get('/api/certificates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should return seeded certificates', async () => {
      const res = await request(app)
        .get('/api/certificates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/certificates/:id', () => {
    test('should get certificate by id', async () => {
      const res = await request(app)
        .get('/api/certificates/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('certificate_number');
    });
  });

  describe('POST /api/certificates', () => {
    test('should create a new certificate', async () => {
      const res = await request(app)
        .post('/api/certificates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          studentId: 1,
          courseId: 1,
          level: 'B1',
          score: 85
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('certificate_number');
    });
  });

  describe('GET /api/certificates search', () => {
    test('search by number returns 200 with matching rows (param/placeholder parity)', async () => {
      const list = await request(app)
        .get('/api/certificates')
        .set('Authorization', `Bearer ${authToken}`);
      const number = list.body.data[0].certificate_number;

      const res = await request(app)
        .get(`/api/certificates?search=${number.slice(0, 8)}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.some((row) => row.certificate_number === number)).toBe(true);
    });
  });

  describe('GET /api/certificates/verify/:code', () => {    test('should verify a certificate', async () => {
      // First get a certificate number
      const certRes = await request(app)
        .get('/api/certificates')
        .set('Authorization', `Bearer ${authToken}`);

      if (certRes.body.data.length > 0) {
        const certNumber = certRes.body.data[0].certificate_number;

        const res = await request(app)
          .get(`/api/certificates/verify/${certNumber}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
      }
    });
  });
});
