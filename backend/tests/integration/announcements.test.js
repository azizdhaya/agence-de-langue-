const request = require('supertest');
const app = require('../../src/app');

describe('Announcements Endpoints', () => {
  let authToken;
  let announcementId;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@center.com', password: 'admin123' });
    authToken = loginRes.body.token;
  });

  describe('POST /api/announcements', () => {
    test('creates an announcement', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Rentrée', content: 'Bienvenue à tous', targetAudience: 'all' });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('announcementId');
      announcementId = res.body.announcementId;
    });

    test('rejects a missing title with 400', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Sans titre' });

      expect(res.statusCode).toBe(400);
    });

    test('rejects a teacher creating an announcement with 403', async () => {
      const teacher = await request(app).post('/api/auth/login')
        .send({ email: 'teacher@center.com', password: 'teacher123' });

      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${teacher.body.token}`)
        .send({ title: 'Nope', content: 'Non autorisé' });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/announcements', () => {
    test('lists announcements', async () => {
      const res = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('hides expired announcements, including global ones', async () => {
      await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Expirée', content: 'Périmée', expiresAt: '2020-01-01' });

      const res = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`);

      // Non-régression : sans parenthèses, une annonce 'all' expirée restait visible.
      expect(res.body.some((a) => a.title === 'Expirée')).toBe(false);
    });
  });

  describe('PUT /api/announcements/:id', () => {
    test('updates an announcement', async () => {
      const res = await request(app)
        .put(`/api/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Rentrée 2026', content: 'Bienvenue à tous' });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/announcements/:id', () => {
    test('deletes an announcement', async () => {
      const res = await request(app)
        .delete(`/api/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });

    test('returns 404 when deleting twice', async () => {
      const res = await request(app)
        .delete(`/api/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('expiry handling', () => {
    test('an announcement without expiry stays visible (empty string means never)', async () => {
      // Non-régression : le formulaire envoie expiresAt: '' quand la date
      // n'est pas touchée ; stocké tel quel, '' échouait au filtre
      // expires_at > now() et l'annonce devenait invisible.
      const created = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Sans expiration', content: 'test', targetAudience: 'all', priority: 'normal', expiresAt: '' });

      expect(created.statusCode).toBe(201);

      const list = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(list.body.some((a) => a.id === created.body.announcementId)).toBe(true);
    });

    test('an expired announcement stays hidden', async () => {
      const created = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Expirée', content: 'test', targetAudience: 'all', priority: 'normal', expiresAt: '2020-01-01' });

      expect(created.statusCode).toBe(201);

      const list = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(list.body.some((a) => a.id === created.body.announcementId)).toBe(false);
    });

    test('a student sees all and students audiences, not teachers', async () => {
      const forTeachers = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Profs only', content: 'test', targetAudience: 'teachers', priority: 'normal' });
      const forStudents = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Candidats only', content: 'test', targetAudience: 'students', priority: 'normal' });

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@center.com', password: 'student123' });
      const list = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${login.body.token}`);
      const ids = list.body.map((a) => a.id);

      expect(list.statusCode).toBe(200);
      expect(ids).toContain(forStudents.body.announcementId);
      expect(ids).not.toContain(forTeachers.body.announcementId);
    });

    test('an announcement expiring today stays visible (expiry day included)', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const created = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Dernier jour', content: 'test', targetAudience: 'all', priority: 'normal', expiresAt: today });

      expect(created.statusCode).toBe(201);

      const list = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(list.body.some((a) => a.id === created.body.announcementId)).toBe(true);
    });

    test('an admin sees audience-targeted announcements too', async () => {
      const created = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Ciblée', content: 'test', targetAudience: 'students', priority: 'normal' });

      expect(created.statusCode).toBe(201);

      const list = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(list.body.some((a) => a.id === created.body.announcementId)).toBe(true);
    });
  });
});
