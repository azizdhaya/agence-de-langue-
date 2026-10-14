const request = require('supertest');
const app = require('../../src/app');

describe('Documents Endpoints', () => {
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

  describe('GET /api/documents', () => {
    test('should get all documents', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('search by name returns 200 with matching rows (param/placeholder parity)', async () => {
      // Non-régression : plusieurs dépôts avaient moins de params.push que de
      // LIKE ?, ce qui faisait échouer toute recherche en 500 SQLITE_MISMATCH.
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          name: 'Contrat QA Recherche',
          type: 'contract',
          filePath: '/uploads/qa-search.pdf',
          fileSize: 10,
          mimeType: 'application/pdf'
        });

      const res = await request(app)
        .get('/api/documents?search=QA%20Recherche')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.some((row) => row.name === 'Contrat QA Recherche')).toBe(true);
    });
  });

  describe('POST /api/documents', () => {
    test('should create a new document', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          name: 'Test Document',
          type: 'contract',
          filePath: '/uploads/test-document.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('name');
    });
  });
});
