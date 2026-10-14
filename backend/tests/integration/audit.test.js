const AuditService = require('../../src/services/AuditService');
const { get } = require('../../src/utils/dbHelpers');

/**
 * AuditService is database-backed. Its only former callers were the financial
 * routes; the service itself is generic, so it is exercised here directly on a
 * pedagogical resource instead of through a removed route.
 */
describe('AuditService (database-backed)', () => {
  // A resource id that no seed row uses, so assertions stay independent of the
  // seeded audit trail.
  const RESOURCE = 'courses';
  const RESOURCE_ID = 990001;
  let adminId;

  beforeAll(async () => {
    const admin = await get("SELECT id FROM users WHERE email = 'admin@center.com'");
    adminId = admin.id;
  });

  afterEach(async () => {
    await AuditService.purge(RESOURCE, RESOURCE_ID);
  });

  test('records an entry and reads it back through historyFor', async () => {
    await AuditService.log({
      userId: adminId, action: 'course.create', resource: RESOURCE, resourceId: RESOURCE_ID,
      newValue: { name: 'Français A1', capacity: 15 }
    });

    const entries = await AuditService.historyFor(RESOURCE, RESOURCE_ID);

    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('course.create');
    expect(entries[0].user_id).toBe(adminId);
    expect(AuditService.deserialise(entries[0].new_value)).toEqual({ name: 'Français A1', capacity: 15 });
  });

  test('stores an unserialisable value with an explicit marker', async () => {
    const circular = { a: 1 };
    circular.self = circular;

    await AuditService.log({
      userId: adminId, action: 'course.update', resource: RESOURCE, resourceId: RESOURCE_ID,
      newValue: circular
    });

    const [entry] = await AuditService.historyFor(RESOURCE, RESOURCE_ID);
    expect(AuditService.deserialise(entry.new_value)).toEqual({ unserialisable: true });
  });

  test('attributes entries to the acting user and joins the email', async () => {
    await AuditService.log({
      userId: adminId, action: 'course.update', resource: RESOURCE, resourceId: RESOURCE_ID
    });

    const [entry] = await AuditService.historyFor(RESOURCE, RESOURCE_ID);
    expect(entry.user_email).toBe('admin@center.com');
  });

  test('historyForUser lists the entries of one user', async () => {
    await AuditService.log({
      userId: adminId, action: 'course.create', resource: RESOURCE, resourceId: RESOURCE_ID
    });

    const entries = await AuditService.historyForUser(adminId, { limit: 50 });

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(e => e.user_id === adminId)).toBe(true);
  });

  test('recent returns the newest entries across resources', async () => {
    await AuditService.log({
      userId: adminId, action: 'course.create', resource: RESOURCE, resourceId: RESOURCE_ID
    });

    const recent = await AuditService.recent({ limit: 5 });

    expect(Array.isArray(recent)).toBe(true);
    expect(recent.some(e => e.resource === RESOURCE)).toBe(true);
  });

  test('summary groups entries by action', async () => {
    await AuditService.log({
      userId: adminId, action: 'course.create', resource: RESOURCE, resourceId: RESOURCE_ID
    });

    const summary = await AuditService.summary();

    expect(Array.isArray(summary)).toBe(true);
    expect(summary.some(row => row.action === 'course.create')).toBe(true);
  });

  test('search filters by resource and action prefix', async () => {
    await AuditService.log({
      userId: adminId, action: 'course.create', resource: RESOURCE, resourceId: RESOURCE_ID
    });

    const rows = await AuditService.search({ resource: RESOURCE, action: 'course.' });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.resource === RESOURCE && r.action.startsWith('course.'))).toBe(true);
  });

  test('purge removes only the entries of one resource id', async () => {
    await AuditService.log({
      userId: adminId, action: 'course.create', resource: RESOURCE, resourceId: RESOURCE_ID
    });

    const removed = await AuditService.purge(RESOURCE, RESOURCE_ID);

    expect(removed).toBe(1);
    expect(await AuditService.historyFor(RESOURCE, RESOURCE_ID)).toEqual([]);
  });

  test('count reflects a written entry', async () => {
    const before = await AuditService.count();

    await AuditService.log({
      userId: adminId, action: 'course.create', resource: RESOURCE, resourceId: RESOURCE_ID
    });

    expect(await AuditService.count()).toBe(before + 1);
  });

  test('a malformed entry resolves to null rather than throwing', async () => {
    await expect(AuditService.log({})).resolves.toBeNull();
    await expect(AuditService.log({ action: 'x' })).resolves.toBeNull();
    await expect(AuditService.log(null)).resolves.toBeNull();
  });
});
