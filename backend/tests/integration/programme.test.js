const request = require('supertest');
const app = require('../../src/app');

/**
 * P1 of the financial module: catalogue (modules/submodules), the price rollup
 * and the charges created when a student is registered to a module. Payments
 * arrive in P2, so every charge is unpaid here.
 */
describe('Course programme & charges', () => {
  let authToken;
  let courseId;
  let moduleId;
  let submoduleA;
  let submoduleB;
  let studentUserId;

  const auth = (req) => req.set('Authorization', `Bearer ${authToken}`);

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@center.com', password: 'admin123' });
    authToken = loginRes.body.token;

    const courseRes = await auth(request(app).post('/api/courses')).send({
      name: 'Programme Test Langue',
      language: 'Testois',
      level: 'beginner',
      price: 0
    });
    courseId = courseRes.body.data.id;

    const studentRes = await auth(request(app).post('/api/students')).send({
      firstName: 'Test',
      lastName: 'Eleve',
      email: `programme-test-${Date.now()}@center.com`,
      password: 'eleve123'
    });
    studentUserId = studentRes.body.data.id;
  });

  test('rejects module creation without a token', async () => {
    const res = await request(app).post(`/api/courses/${courseId}/modules`).send({ name: 'X' });
    expect(res.statusCode).toBe(401);
  });

  test('creates a module under a course', async () => {
    const res = await auth(request(app).post(`/api/courses/${courseId}/modules`)).send({
      name: 'Module Test 1',
      discountPercent: 10
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.name).toBe('Module Test 1');
    expect(res.body.data.discount_percent).toBe(10);
    moduleId = res.body.data.id;
  });

  test('refuses a module on an unknown course', async () => {
    const res = await auth(request(app).post('/api/courses/999999/modules')).send({ name: 'X' });
    expect(res.statusCode).toBe(404);
  });

  test('creates submodules carrying the price in millimes', async () => {
    const resA = await auth(request(app).post(`/api/modules/${moduleId}/submodules`)).send({
      name: 'Sous-module A',
      price: 120.5
    });
    expect(resA.statusCode).toBe(201);
    expect(resA.body.data.price_millimes).toBe(120500);
    expect(resA.body.data.price).toBe(120.5);
    submoduleA = resA.body.data;

    const resB = await auth(request(app).post(`/api/modules/${moduleId}/submodules`)).send({
      name: 'Sous-module B',
      price: 80
    });
    expect(resB.statusCode).toBe(201);
    submoduleB = resB.body.data;
  });

  test('refuses a submodule without a price', async () => {
    const res = await auth(request(app).post(`/api/modules/${moduleId}/submodules`)).send({
      name: 'Sans prix'
    });
    expect(res.statusCode).toBe(400);
  });

  test('rolls the module price up from its submodules', async () => {
    const res = await auth(request(app).get(`/api/modules/${moduleId}`));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.price_millimes).toBe(200500);
    expect(res.body.data.submodules).toHaveLength(2);
  });

  test('lists the programme of the course', async () => {
    const res = await auth(request(app).get(`/api/courses/${courseId}/modules`));
    expect(res.statusCode).toBe(200);
    const module = res.body.data.find((item) => item.id === moduleId);
    expect(module).toBeDefined();
    expect(module.price_millimes).toBe(200500);
  });

  test('enrolling with modules snapshots the charges', async () => {
    const res = await auth(request(app).post(`/api/courses/${courseId}/enroll`)).send({
      studentId: studentUserId,
      confirmed: true,
      moduleIds: [moduleId]
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.charges).toHaveLength(1);
    expect(res.body.data.charges[0]).toMatchObject({ moduleId, created: true, charges: 2 });
  });

  test('the ledger shows the charges and their totals', async () => {
    const res = await auth(request(app).get(`/api/students/${studentUserId}/ledger`));
    expect(res.statusCode).toBe(200);
    const { totals, enrollments } = res.body.data;
    expect(totals.price_millimes).toBe(200500);
    expect(totals.paid_millimes).toBe(0);
    expect(totals.balance_millimes).toBe(200500);
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].modules[0].submodules).toHaveLength(2);
    expect(enrollments[0].modules[0].paid).toBe(false);
  });

  test('re-registering the same module is idempotent', async () => {
    const res = await auth(request(app).post(`/api/courses/${courseId}/enroll`)).send({
      studentId: studentUserId,
      confirmed: true,
      moduleIds: [moduleId]
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.charges[0].charges).toBe(0);

    const ledger = await auth(request(app).get(`/api/students/${studentUserId}/ledger`));
    expect(ledger.body.data.totals.price_millimes).toBe(200500);
  });

  test('a per-enrolment price override is honoured', async () => {
    const studentRes = await auth(request(app).post('/api/students')).send({
      firstName: 'Override',
      lastName: 'Eleve',
      email: `programme-override-${Date.now()}@center.com`,
      password: 'eleve123'
    });
    const overrides = {};
    overrides[submoduleA.id] = 100;
    overrides[submoduleB.id] = 50;

    const res = await auth(request(app).post(`/api/courses/${courseId}/enroll`)).send({
      studentId: studentRes.body.data.id,
      confirmed: true,
      moduleIds: [moduleId],
      priceOverrides: overrides
    });
    expect(res.statusCode).toBe(201);

    const ledger = await auth(request(app).get(`/api/students/${studentRes.body.data.id}/ledger`));
    expect(ledger.body.data.totals.price_millimes).toBe(150000);
  });

  test('a catalogue edit does not rewrite an existing charge', async () => {
    await auth(request(app).put(`/api/submodules/${submoduleA.id}`)).send({ price: 999 });
    const ledger = await auth(request(app).get(`/api/students/${studentUserId}/ledger`));
    expect(ledger.body.data.totals.price_millimes).toBe(200500);
  });

  test('a module in use cannot be deleted', async () => {
    const res = await auth(request(app).delete(`/api/modules/${moduleId}`));
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('MODULE_IN_USE');
  });

  test('a submodule in use cannot be deleted', async () => {
    const res = await auth(request(app).delete(`/api/submodules/${submoduleA.id}`));
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('SUBMODULE_IN_USE');
  });

  test('student without a token cannot read their ledger', async () => {
    const res = await request(app).get(`/api/students/${studentUserId}/ledger`);
    expect(res.statusCode).toBe(401);
  });
});
