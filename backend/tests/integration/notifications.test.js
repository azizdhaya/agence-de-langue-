const request = require('supertest');
const app = require('../../src/app');

describe('Notifications Endpoints', () => {
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

  describe('GET /api/notifications', () => {
    test('should get all notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should return seeded notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/notifications/mine', () => {
    test('should get current user notifications', async () => {
      const res = await request(app)
        .get('/api/notifications/mine')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('unreadCount');
    });
  });

  describe('POST /api/notifications', () => {
    test('should create a new notification', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          title: 'Test Notification',
          message: 'This is a test notification',
          type: 'info'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('title');
    });

    test('should fail without required fields', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    test('should mark notification as read', async () => {
      // Create a notification first
      const createRes = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          title: 'Test Mark Read',
          message: 'Test message'
        });

      const notificationId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('is_read', 1);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    test('should mark all notifications as read', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('student ownership on mark-as-read', () => {
    let studentToken;
    let studentUserId;

    beforeAll(async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@center.com', password: 'student123' });
      studentToken = login.body.token;
      const { get } = require('../../src/utils/dbHelpers');
      studentUserId = (await get("SELECT id FROM users WHERE email = 'student@center.com'")).id;
    });

    test('a student marks their own notification as read', async () => {
      // Non-régression : le contrôle lisait user_id sur le résultat brut de
      // l'UPDATE ({ id, is_read }), donc undefined !== id → 403 abusif.
      const created = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: studentUserId, title: 'Relance', message: 'Facture due' });

      const res = await request(app)
        .put(`/api/notifications/${created.body.data.id}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toMatchObject({ is_read: 1, user_id: studentUserId });
    });

    test("a student cannot mark another user's notification (no side effect)", async () => {
      const created = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 1, title: 'Admin', message: 'ne pas toucher' });

      const res = await request(app)
        .put(`/api/notifications/${created.body.data.id}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(403);

      const { get } = require('../../src/utils/dbHelpers');
      const row = await get('SELECT is_read FROM notifications WHERE id = ?', [created.body.data.id]);
      expect(row.is_read).toBe(0);
    });

    test('an unknown notification answers 404, not a crash', async () => {
      // Non-régression : AppError n'était pas importé dans le service.
      const res = await request(app)
        .put('/api/notifications/999999/read')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(404);
    });
  });
});