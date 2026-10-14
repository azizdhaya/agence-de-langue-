const request = require('supertest');
const app = require('../../src/app');
const { get } = require('../../src/utils/dbHelpers');

describe('Group membership', () => {
  let authToken;
  let courseId;
  let otherCourseId;
  let groupId;

  const asAdmin = (method, path, body) => {
    const req = request(app)[method](path).set('Authorization', `Bearer ${authToken}`);
    return body ? req.send(body) : req;
  };

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@center.com', password: 'admin123' });
    authToken = res.body.token;

    const course = await asAdmin('post', '/api/courses', {
      name: 'Groupe-Test Cours', language: 'Français', level: 'beginner', price: 500
    });
    courseId = course.body.data.id;
    const other = await asAdmin('post', '/api/courses', {
      name: 'Autre Cours', language: 'Anglais', level: 'beginner', price: 500
    });
    otherCourseId = other.body.data.id;

    const group = await asAdmin('post', '/api/groups', {
      name: 'Groupe-Test A', courseId, maxStudents: 2
    });
    groupId = group.body.data.id;
  });

  test('enrols a student straight into the group (user id accepted)', async () => {
    // Pierre, carried by his users-table id like every UI picker.
    const pierre = await get("SELECT id FROM users WHERE email = 'student@center.com'");

    const res = await asAdmin('post', `/api/courses/${courseId}/enroll`, {
      studentId: pierre.id, groupId, confirmed: true
    });

    expect(res.statusCode).toBe(201);
    const row = await get('SELECT student_id, group_id FROM enrollments WHERE id = ?', [res.body.data.enrollmentId]);
    expect(row.group_id).toBe(groupId);
    expect(row.student_id).toBe(1);
  });

  test('lists the group members', async () => {
    const res = await asAdmin('get', `/api/groups/${groupId}/students`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toMatchObject({ student_id: expect.any(Number) });
  });

  test('refuses a group from another course', async () => {
    const res = await asAdmin('post', `/api/courses/${otherCourseId}/enroll`, {
      studentId: 2, groupId, confirmed: true
    });

    expect(res.statusCode).toBe(422);
    expect(res.body.error.code).toBe('GROUP_COURSE_MISMATCH');
  });

  test('refuses overfilling the group', async () => {
    // Group capacity is 2 and Pierre already occupies a seat.
    await asAdmin('post', `/api/courses/${courseId}/enroll`, {
      studentId: 2, groupId, confirmed: true
    });

    const res = await asAdmin('post', `/api/courses/${courseId}/enroll`, {
      studentId: 3, groupId, confirmed: true
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('GROUP_FULL');
  });

  test('re-enrolling with a group moves the enrolment', async () => {
    const second = await asAdmin('post', '/api/groups', {
      name: 'Groupe-Test B', courseId, maxStudents: 5
    });

    const res = await asAdmin('post', `/api/courses/${courseId}/enroll`, {
      studentId: 2, groupId: second.body.data.id, confirmed: true
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.moved).toBe(true);
  });

  test('removes the student from the group AND unenrolls from the course', async () => {
    const members = await asAdmin('get', `/api/groups/${groupId}/students`);
    const member = members.body.data[0];

    const res = await asAdmin('delete', `/api/groups/${groupId}/students/${member.user_id}`);

    expect(res.statusCode).toBe(200);
    const left = await asAdmin('get', `/api/groups/${groupId}/students`);
    expect(left.body.data.some((row) => row.user_id === member.user_id)).toBe(false);

    // The course headcount drops too: no per-candidate round-trip needed.
    const courseStudents = await asAdmin('get', `/api/courses/${courseId}/students`);
    expect(courseStudents.body.data.some((row) => row.id === member.user_id)).toBe(false);
  });

  test('removing an enrolled member deletes the enrolment and answers 200', async () => {
    const pierre = await get("SELECT id FROM users WHERE email = 'student2@center.com'");
    await asAdmin('post', `/api/courses/${courseId}/enroll`, {
      studentId: pierre.id, groupId, confirmed: true
    });

    const members = await asAdmin('get', `/api/groups/${groupId}/students`);
    const member = members.body.data.find((row) => row.user_id === pierre.id);

    const res = await asAdmin('delete', `/api/groups/${groupId}/students/${member.user_id}`);

    expect(res.statusCode).toBe(200);
    const after = await asAdmin('get', `/api/groups/${groupId}/students`);
    expect(after.body.data.some((row) => row.user_id === pierre.id)).toBe(false);
  });

  test('removing a non-member answers 404', async () => {
    const res = await asAdmin('delete', `/api/groups/${groupId}/students/999999`);

    expect(res.statusCode).toBe(404);
  });

  test('a teacher reads members but cannot remove them', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@center.com', password: 'teacher123' });
    const token = login.body.token;

    const read = await request(app)
      .get(`/api/groups/${groupId}/students`)
      .set('Authorization', `Bearer ${token}`);
    expect(read.statusCode).toBe(200);

    const del = await request(app)
      .delete(`/api/groups/${groupId}/students/1`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.statusCode).toBe(403);
  });
});
