const request = require('supertest');
const app = require('../../src/app');

describe('Sessions Endpoints', () => {
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

  describe('GET /api/sessions', () => {
    test('should get all sessions', async () => {
      const res = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should return seeded sessions', async () => {
      const res = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/sessions/:id', () => {
    test('should get session by id', async () => {
      const res = await request(app)
        .get('/api/sessions/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('date');
    });
  });

  describe('POST /api/sessions', () => {
    test('should create a new session', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          groupId: 1,
          teacherId: 1,
          room: 'Salle 101',
          date: '2024-01-20',
          startTime: '09:00',
          endTime: '11:00'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    });

    test('should refuse a non-date value instead of storing garbage', async () => {
      // Non-régression : des lignes avec date='[object Object]' ont pollué la
      // base — un objet ne doit jamais passer la validation.
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          groupId: 1,
          date: { year: 2024, month: 1, day: 20 },
          startTime: '09:00',
          endTime: '11:00'
        });

      expect(res.statusCode).toBe(400);
    });

    test('should normalise a millisecond timestamp to YYYY-MM-DD', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          groupId: 1,
          date: 1791244800000,
          startTime: '09:00',
          endTime: '11:00'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.date).toBe('2026-10-06');

      await request(app)
        .delete(`/api/sessions/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('should refuse an unknown teacher with 404', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          groupId: 1,
          teacherId: 999999,
          date: '2024-01-20',
          startTime: '09:00',
          endTime: '11:00'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('TEACHER_NOT_FOUND');
    });

    test('should refuse an unknown group with 404', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          groupId: 999999,
          date: '2024-01-20',
          startTime: '09:00',
          endTime: '11:00'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('GROUP_NOT_FOUND');
    });

    test('should refuse an end time before the start time', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 1, date: '2026-12-01', startTime: '11:00', endTime: '09:00' });

      expect(res.statusCode).toBe(422);
      expect(res.body.error.code).toBe('INVALID_TIME_RANGE');
    });

    test('should refuse a badly formatted time', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 1, date: '2026-12-01', startTime: '9h', endTime: '11:00' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should refuse a teacher double-booking on overlapping hours', async () => {
      await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 1, teacherId: 1, date: '2026-12-02', startTime: '09:00', endTime: '11:00' });

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 2, teacherId: 1, date: '2026-12-02', startTime: '10:00', endTime: '12:00' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('SESSION_CONFLICT');
    });

    test('should refuse a room double-booking on overlapping hours', async () => {
      await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 1, room: 'Salle Conflit', date: '2026-12-03', startTime: '09:00', endTime: '11:00' });

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 2, room: 'Salle Conflit', date: '2026-12-03', startTime: '10:30', endTime: '12:00' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('SESSION_CONFLICT');
    });

    test('should allow back-to-back sessions for the same teacher and room', async () => {
      await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 1, teacherId: 1, room: 'Salle Suite', date: '2026-12-04', startTime: '09:00', endTime: '11:00' });

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 2, teacherId: 1, room: 'Salle Suite', date: '2026-12-04', startTime: '11:00', endTime: '13:00' });

      expect(res.statusCode).toBe(201);
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    test('refuses a session with attendance instead of a raw FK 500', async () => {
      const session = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 1, date: '2026-11-21', startTime: '09:00', endTime: '11:00' });
      await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 1, courseId: 1, date: '2026-11-21', status: 'present' });

      // Attendance references sessions only when a session_id is set; force
      // the link to prove the guard (see second test for the clean path).
      const { run } = require('../../src/utils/dbHelpers');
      const att = await require('../../src/utils/dbHelpers').get(
        'SELECT id FROM attendance WHERE date = ?', ['2026-11-21']
      );
      await run('UPDATE attendance SET session_id = ? WHERE id = ?', [session.body.data.id, att.id]);

      const res = await request(app)
        .delete(`/api/sessions/${session.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('SESSION_HAS_ATTENDANCE');
    });

    test('deletes a session without attendance cleanly', async () => {
      const session = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: 1, date: '2026-11-03', startTime: '09:00', endTime: '11:00' });

      const res = await request(app)
        .delete(`/api/sessions/${session.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });
  });
});
