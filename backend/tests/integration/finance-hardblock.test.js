const request = require('supertest');
const app = require('../../src/app');

/**
 * P3: due dates, the hard attendance block on an unpaid submodule, and the
 * payment receipt read model.
 *
 * The rule: a submodule is billed before it starts, so a student who still owes
 * for the submodule a séance teaches cannot be marked present. The check goes
 * through `sessions.submodule_id`; a séance without a submodule blocks nobody.
 */
describe('Finance hard block & receipts (P3)', () => {
  let authToken;
  let courseId;
  let groupId;
  let moduleId;
  let submoduleId;
  let sessionId;
  let studentId; // users id (UI convention)
  let enrollmentSubmoduleId;

  const auth = (req) => req.set('Authorization', `Bearer ${authToken}`);

  const createStudent = async (tag) => {
    const res = await auth(request(app).post('/api/students')).send({
      firstName: tag,
      lastName: 'Present',
      email: `block-${tag}-${Date.now()}@center.com`,
      password: 'eleve123'
    });
    return res.body.data.id;
  };

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@center.com', password: 'admin123' });
    authToken = loginRes.body.token;

    const courseRes = await auth(request(app).post('/api/courses')).send({
      name: 'Blocage Test Langue',
      language: 'Bloquois',
      level: 'beginner',
      price: 0
    });
    courseId = courseRes.body.data.id;

    const moduleRes = await auth(request(app).post(`/api/courses/${courseId}/modules`)).send({
      name: 'Module Blocage',
      discountPercent: 0
    });
    moduleId = moduleRes.body.data.id;

    const subRes = await auth(request(app).post(`/api/modules/${moduleId}/submodules`)).send({
      name: 'Sous Blocage',
      price: 150
    });
    submoduleId = subRes.body.data.id;

    const groupRes = await auth(request(app).post('/api/groups')).send({
      name: 'Groupe Blocage',
      courseId
    });
    groupId = groupRes.body.data.id;

    const sessionRes = await auth(request(app).post('/api/sessions')).send({
      groupId,
      date: '2026-11-03',
      startTime: '09:00',
      endTime: '11:00',
      submoduleId
    });
    sessionId = sessionRes.body.data.id;

    studentId = await createStudent('eleve');
    const enrollRes = await auth(request(app).post(`/api/courses/${courseId}/enroll`)).send({
      studentId,
      confirmed: true,
      moduleIds: [moduleId]
    });
    expect(enrollRes.statusCode).toBe(201);

    const ledgerRes = await auth(request(app).get(`/api/students/${studentId}/ledger`));
    enrollmentSubmoduleId = ledgerRes.body.data.enrollments[0].modules[0].submodules[0]
      .enrollment_submodule_id;
  });

  it('snapshots a registration due date on the charge', async () => {
    const { get } = require('../../src/utils/dbHelpers');
    const row = await get(
      'SELECT due_date, status FROM enrollment_submodules WHERE id = ?',
      [enrollmentSubmoduleId]
    );
    expect(row.due_date).toBeTruthy();
    expect(row.status).toBe('unpaid');
  });

  it('reports the unpaid student on the séance roster', async () => {
    const res = await auth(request(app).get(`/api/attendance/session/${sessionId}/roster`));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.session.submodule_id).toBe(submoduleId);
    const line = res.body.data.students.find((s) => s.student_id === studentId);
    expect(line.status).toBe('unpaid');
  });

  it('refuses a single attendance row while the submodule is unpaid', async () => {
    const res = await auth(request(app).post('/api/attendance')).send({
      studentId,
      courseId,
      sessionId,
      date: '2026-11-03',
      status: 'present'
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('SUBMODULE_UNPAID');
  });

  it('refuses a whole batch written while the submodule is unpaid', async () => {
    const { get } = require('../../src/utils/dbHelpers');
    const before = await get('SELECT COUNT(*) AS n FROM attendance WHERE session_id = ?', [sessionId]);

    const res = await auth(request(app).post('/api/attendance/bulk')).send({
      courseId,
      sessionId,
      date: '2026-11-03',
      attendanceData: [{ studentId, status: 'present' }]
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('SUBMODULE_UNPAID');

    const after = await get('SELECT COUNT(*) AS n FROM attendance WHERE session_id = ?', [sessionId]);
    expect(after.n).toBe(before.n);
  });

  it('opens the receipt with the student and the allocated lines', async () => {
    const payRes = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      method: 'cash',
      reference: 'RECU-1',
      items: [{ enrollmentSubmoduleId }]
    });
    expect(payRes.statusCode).toBe(201);
    const paymentId = payRes.body.data.id;

    const res = await auth(request(app).get(`/api/payments/${paymentId}`));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.student_name).toMatch(/Present/);
    expect(res.body.data.amount_millimes).toBe(150000);
    expect(res.body.data.recorded_by_name).toBeTruthy();
    expect(res.body.data.allocations[0]).toMatchObject({
      submodule_name: 'Sous Blocage',
      module_name: 'Module Blocage',
      course_name: 'Blocage Test Langue',
      amount_millimes: 150000
    });
  });

  it('allows attendance once the submodule is paid', async () => {
    const res = await auth(request(app).post('/api/attendance')).send({
      studentId,
      courseId,
      sessionId,
      date: '2026-11-03',
      status: 'present'
    });
    expect(res.statusCode).toBe(201);

    const roster = await auth(request(app).get(`/api/attendance/session/${sessionId}/roster`));
    const line = roster.body.data.students.find((s) => s.student_id === studentId);
    expect(line.status).toBe('paid');
  });

  it('does not block attendance when the séance teaches no submodule', async () => {
    const plainSession = await auth(request(app).post('/api/sessions')).send({
      groupId,
      date: '2026-11-04',
      startTime: '09:00',
      endTime: '11:00'
    });
    expect(plainSession.statusCode).toBe(201);

    const other = await createStudent('libre');
    await auth(request(app).post(`/api/courses/${courseId}/enroll`)).send({
      studentId: other,
      confirmed: true,
      moduleIds: [moduleId]
    });

    const res = await auth(request(app).post('/api/attendance')).send({
      studentId: other,
      courseId,
      sessionId: plainSession.body.data.id,
      date: '2026-11-04',
      status: 'present'
    });
    expect(res.statusCode).toBe(201);
  });
});
