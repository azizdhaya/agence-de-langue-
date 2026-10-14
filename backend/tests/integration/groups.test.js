const request = require('supertest');
const app = require('../../src/app');

describe('Groups Endpoints', () => {
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

  describe('GET /api/groups', () => {
    test('should get all groups', async () => {
      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should return seeded groups', async () => {
      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/groups/:id', () => {
    test('should get group by id', async () => {
      const res = await request(app)
        .get('/api/groups/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('name');
    });
  });

  describe('POST /api/groups', () => {
    test('should create a new group', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Group',
          courseId: 1,
          teacherId: 1,
          room: 'Salle Test',
          maxStudents: 10
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    });

    test('should create a group with the teacher table id from /teachers', async () => {
      // Non-régression : le formulaire envoyait l'ID utilisateur, rejeté par la FK.
      const teachers = await request(app)
        .get('/api/teachers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(teachers.body[0]).toHaveProperty('teacher_id');
      const teacherId = teachers.body[0].teacher_id;

      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Groupe FK', courseId: 1, teacherId, maxStudents: 10 });

      expect(res.statusCode).toBe(201);

      await request(app)
        .delete(`/api/groups/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('should refuse an unknown teacher with 404, not a raw 500', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Bad Teacher', courseId: 1, teacherId: 999999 });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('TEACHER_NOT_FOUND');
    });

    test('should refuse an unknown course with 404', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Bad Course', courseId: 999999 });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('COURSE_NOT_FOUND');
    });
  });

  describe('DELETE /api/groups/:id', () => {
    test('refuses a group with sessions instead of a raw FK 500', async () => {
      // Non-régression : supprimer un groupe avec séances échouait en
      // SQLITE_CONSTRAINT brut au lieu d'expliquer le blocage.
      const group = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Groupe Verrou', courseId: 1, maxStudents: 10 });
      await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ groupId: group.body.data.id, date: '2026-11-01', startTime: '09:00', endTime: '11:00' });

      const res = await request(app)
        .delete(`/api/groups/${group.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('GROUP_IN_USE');
      expect(JSON.stringify(res.body)).not.toContain('SQLITE_CONSTRAINT');
    });

    test('deletes an empty group cleanly', async () => {
      const group = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Groupe Jetable', courseId: 1, maxStudents: 10 });

      const res = await request(app)
        .delete(`/api/groups/${group.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });

    test('deleting a group auto-unenrolls its clean members from the course', async () => {
      // Pratique : un seul clic, sans parcourir chaque candidat. Le compteur
      // du cours baisse aussi.
      const course = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cours Cascade', language: 'Anglais', level: 'A1', price: 50 });
      const group = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Groupe Cascade', courseId: course.body.data.id, maxStudents: 10 });
      const enrolled = await request(app)
        .post(`/api/courses/${course.body.data.id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 3, confirmed: true, groupId: group.body.data.id });

      const res = await request(app)
        .delete(`/api/groups/${group.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      const { get } = require('../../src/utils/dbHelpers');
      const row = await get('SELECT id FROM enrollments WHERE id = ?', [enrolled.body.data.enrollmentId]);
      expect(row).toBeUndefined();
    });

    test('deletes a group whose member has an enrolment, removing the enrolment', async () => {
      const course = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cours Enrole', language: 'Anglais', level: 'A1', price: 50 });
      const group = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Groupe Enrole', courseId: course.body.data.id, maxStudents: 10 });
      const enrolled = await request(app)
        .post(`/api/courses/${course.body.data.id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ studentId: 3, confirmed: true, groupId: group.body.data.id });

      const res = await request(app)
        .delete(`/api/groups/${group.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      const { get } = require('../../src/utils/dbHelpers');
      const row = await get('SELECT id FROM enrollments WHERE id = ?', [enrolled.body.data.enrollmentId]);
      expect(row).toBeUndefined();
    });
  });
});
