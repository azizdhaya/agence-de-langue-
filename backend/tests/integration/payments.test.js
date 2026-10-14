const request = require('supertest');
const app = require('../../src/app');

/**
 * P2: recording money and spreading it over the submodule charges. The
 * allocation rows drive the cache; balances are always read back from the
 * ledger, never trusted from the request.
 */
describe('Payments & allocations', () => {
  let authToken;
  let courseId;
  let moduleA; // [100, 200] with a 10% whole-module discount
  let moduleB; // [300], no discount

  const auth = (req) => req.set('Authorization', `Bearer ${authToken}`);

  const createStudent = async (tag) => {
    const res = await auth(request(app).post('/api/students')).send({
      firstName: tag,
      lastName: 'Payeur',
      email: `payment-${tag}-${Date.now()}@center.com`,
      password: 'eleve123'
    });
    return res.body.data.id;
  };

  const createModule = async (name, discountPercent, submodules) => {
    const moduleRes = await auth(request(app).post(`/api/courses/${courseId}/modules`)).send({
      name,
      discountPercent
    });
    const module = moduleRes.body.data;
    module.submodules = [];
    for (const [subName, price] of submodules) {
      const subRes = await auth(request(app).post(`/api/modules/${module.id}/submodules`)).send({
        name: subName,
        price
      });
      module.submodules.push(subRes.body.data);
    }
    return module;
  };

  const enroll = async (studentId, moduleIds) => {
    const res = await auth(request(app).post(`/api/courses/${courseId}/enroll`)).send({
      studentId,
      confirmed: true,
      moduleIds
    });
    return res;
  };

  const ledger = async (studentId) => {
    const res = await auth(request(app).get(`/api/students/${studentId}/ledger`));
    return res.body.data;
  };

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@center.com', password: 'admin123' });
    authToken = loginRes.body.token;

    const courseRes = await auth(request(app).post('/api/courses')).send({
      name: 'Paiement Test Langue',
      language: 'Testois',
      level: 'beginner',
      price: 0
    });
    courseId = courseRes.body.data.id;

    moduleA = await createModule('Module Pay A', 10, [['A-1', 100], ['A-2', 200]]);
    moduleB = await createModule('Module Pay B', 0, [['B-1', 300]]);
  });

  const moduleAOf = (data) => data.enrollments[0].modules.find((m) => m.module_id === moduleA.id);

  it('pays one submodule in full', async () => {
    const studentId = await createStudent('sub');
    await enroll(studentId, [moduleA.id]);
    const before = await ledger(studentId);
    const sub = moduleAOf(before).submodules[0];

    const res = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      method: 'cash',
      items: [{ enrollmentSubmoduleId: sub.enrollment_submodule_id }]
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.amount_millimes).toBe(100000);
    expect(res.body.data.allocations).toHaveLength(1);

    const after = await ledger(studentId);
    expect(after.totals.paid_millimes).toBe(100000);
    expect(after.totals.balance_millimes).toBe(200000);
    expect(moduleAOf(after).paid).toBe(false);
    expect(after.payments).toHaveLength(1);
    expect(after.payments[0].allocations[0].submodule_name).toBe('A-1');
  });

  it('refuses to pay an already-paid submodule again', async () => {
    const studentId = await createStudent('again');
    await enroll(studentId, [moduleA.id]);
    const data = await ledger(studentId);
    const sub = moduleAOf(data).submodules[0];

    const first = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      items: [{ enrollmentSubmoduleId: sub.enrollment_submodule_id }]
    });
    expect(first.statusCode).toBe(201);

    const second = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      items: [{ enrollmentSubmoduleId: sub.enrollment_submodule_id }]
    });
    expect(second.statusCode).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_PAID');
  });

  it('settles a clean module with a discount distributed over its submodules', async () => {
    const studentId = await createStudent('whole');
    await enroll(studentId, [moduleA.id]);
    const data = await ledger(studentId);
    const moduleLine = moduleAOf(data);

    const res = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      method: 'card',
      items: [{ enrollmentModuleId: moduleLine.enrollment_module_id, discountPercent: 10 }]
    });
    expect(res.statusCode).toBe(201);
    // 10% of 300000 = 30000 → allocations 90000 + 180000.
    expect(res.body.data.amount_millimes).toBe(270000);
    expect(res.body.data.allocations.map((a) => a.amount_millimes).sort((a, b) => a - b)).toEqual([90000, 180000]);

    const after = await ledger(studentId);
    expect(after.totals.price_millimes).toBe(300000);
    expect(after.totals.discount_millimes).toBe(30000);
    expect(after.totals.paid_millimes).toBe(270000);
    expect(after.totals.balance_millimes).toBe(0);
    const settled = moduleAOf(after);
    expect(settled.paid).toBe(true);
    expect(settled.discount_percent).toBe(10);
    expect(settled.submodules.every((s) => s.status === 'paid')).toBe(true);
  });

  it('refuses a whole-module discount once a submodule is already paid', async () => {
    const studentId = await createStudent('dirty');
    await enroll(studentId, [moduleA.id]);
    const data = await ledger(studentId);
    const moduleLine = moduleAOf(data);
    const firstSub = moduleLine.submodules[0];

    await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      items: [{ enrollmentSubmoduleId: firstSub.enrollment_submodule_id }]
    });

    const res = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      items: [{ enrollmentModuleId: moduleLine.enrollment_module_id, discountPercent: 10 }]
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('MODULE_NOT_CLEAN');
  });

  it('lets a dirty module be settled in full at the full price (no discount)', async () => {
    const studentId = await createStudent('rest');
    await enroll(studentId, [moduleA.id]);
    const data = await ledger(studentId);
    const moduleLine = moduleAOf(data);
    const firstSub = moduleLine.submodules[0];

    await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      items: [{ enrollmentSubmoduleId: firstSub.enrollment_submodule_id }]
    });

    const res = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      items: [{ enrollmentModuleId: moduleLine.enrollment_module_id, discountPercent: 0 }]
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.amount_millimes).toBe(200000);

    const after = await ledger(studentId);
    expect(after.totals.paid_millimes).toBe(300000);
    expect(after.totals.balance_millimes).toBe(0);
    expect(moduleAOf(after).discount_percent).toBe(0);
  });

  it('records several modules, each with its own percent, in one payment', async () => {
    const studentId = await createStudent('multi');
    await enroll(studentId, [moduleA.id, moduleB.id]);
    const data = await ledger(studentId);
    const lineA = data.enrollments[0].modules.find((m) => m.module_id === moduleA.id);
    const lineB = data.enrollments[0].modules.find((m) => m.module_id === moduleB.id);

    const res = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      method: 'transfer',
      reference: 'VIR-001',
      items: [
        { enrollmentModuleId: lineA.enrollment_module_id, discountPercent: 10 },
        { enrollmentModuleId: lineB.enrollment_module_id, discountPercent: 0 }
      ]
    });
    expect(res.statusCode).toBe(201);
    // 270000 (module A after 10%) + 300000 (module B) = 570000 in a single receipt.
    expect(res.body.data.amount_millimes).toBe(570000);
    expect(res.body.data.allocations).toHaveLength(3);

    const after = await ledger(studentId);
    expect(after.totals.paid_millimes).toBe(570000);
    expect(after.totals.balance_millimes).toBe(0);
    expect(after.payments).toHaveLength(1);
  });

  it('voids a payment and restores the balance', async () => {
    const studentId = await createStudent('void');
    await enroll(studentId, [moduleA.id]);
    const data = await ledger(studentId);
    const moduleLine = moduleAOf(data);

    const paymentRes = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      items: [{ enrollmentModuleId: moduleLine.enrollment_module_id, discountPercent: 10 }]
    });
    const paymentId = paymentRes.body.data.id;
    expect((await ledger(studentId)).totals.balance_millimes).toBe(0);

    const del = await auth(request(app).delete(`/api/payments/${paymentId}`));
    expect(del.statusCode).toBe(200);

    const after = await ledger(studentId);
    expect(after.totals.balance_millimes).toBe(300000);
    expect(moduleAOf(after).paid).toBe(false);
    expect(after.payments).toHaveLength(0);
  });

  it('rejects an empty item list', async () => {
    const studentId = await createStudent('empty');
    const res = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({ items: [] });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid method', async () => {
    const studentId = await createStudent('badmethod');
    await enroll(studentId, [moduleA.id]);
    const data = await ledger(studentId);
    const sub = moduleAOf(data).submodules[0];
    const res = await auth(request(app).post(`/api/students/${studentId}/payments`)).send({
      method: 'bitcoin',
      items: [{ enrollmentSubmoduleId: sub.enrollment_submodule_id }]
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires a token to record a payment', async () => {
    const studentId = await createStudent('notoken');
    const res = await request(app).post(`/api/students/${studentId}/payments`).send({
      items: [{ enrollmentSubmoduleId: 1 }]
    });
    expect(res.statusCode).toBe(401);
  });
});
