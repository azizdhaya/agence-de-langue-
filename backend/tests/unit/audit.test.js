const AuditService = require('../../src/services/AuditService');
const rbac = require('../../src/middleware/rbac');

describe('AuditService - surface', () => {
  test('exposes the logging and reading helpers', () => {
    for (const method of ['log', 'logFromRequest', 'historyFor', 'historyForUser', 'recent', 'summary', 'purge', 'count', 'serialise', 'deserialise']) {
      expect(typeof AuditService[method]).toBe('function');
    }
  });

  test('log is async so a caller can await the write', () => {
    expect(AuditService.log.constructor.name).toBe('AsyncFunction');
  });
});

describe('AuditService - serialisation', () => {
  test('encodes an object as JSON', () => {
    expect(AuditService.serialise({ total: 100 })).toBe('{"total":100}');
  });

  test('returns null for absent values so the column stays meaningful', () => {
    expect(AuditService.serialise(undefined)).toBeNull();
    expect(AuditService.serialise(null)).toBeNull();
  });

  test('encodes a zero rather than treating it as absent', () => {
    expect(AuditService.serialise(0)).toBe('0');
    expect(AuditService.serialise(false)).toBe('false');
    expect(AuditService.serialise('')).toBe('""');
  });

  test('survives a circular structure with an explicit marker', () => {
    const circular = { a: 1 };
    circular.self = circular;

    // JSON.stringify throws on a cycle; the fallback records that fact rather
    // than losing the whole entry.
    expect(() => AuditService.serialise(circular)).not.toThrow();
    expect(AuditService.deserialise(AuditService.serialise(circular)))
      .toEqual({ unserialisable: true });
  });

  test('renders a BigInt as a string instead of throwing', () => {
    expect(() => AuditService.serialise({ id: BigInt(7) })).not.toThrow();
    expect(AuditService.serialise({ id: BigInt(7) })).toBe('{"id":"7"}');
  });

  test('deserialise returns null on malformed JSON', () => {
    expect(AuditService.deserialise('{oops')).toBeNull();
    expect(AuditService.deserialise(null)).toBeNull();
  });

  test('round-trips a payload', () => {
    const payload = { name: 'Français Débutant', level: 'A1', capacity: 15 };
    expect(AuditService.deserialise(AuditService.serialise(payload))).toEqual(payload);
  });
});

describe('AuditService - failure tolerance', () => {
  test('a malformed entry resolves to null rather than throwing', async () => {
    // The caller may have already committed its own write: an audit problem must
    // never surface as a failure of the business action.
    await expect(AuditService.log({})).resolves.toBeNull();
    await expect(AuditService.log({ action: 'x' })).resolves.toBeNull();
    await expect(AuditService.log(null)).resolves.toBeNull();
  });
});

describe('RBAC permission vocabulary', () => {
  test('declares the document and certificate permissions', () => {
    expect(rbac.ALL_PERMISSIONS).toEqual(expect.arrayContaining([
      'documents:read', 'documents:write', 'certificates:read', 'certificates:write'
    ]));
  });

  test('the vocabulary is frozen so a route cannot extend it at runtime', () => {
    expect(Object.isFrozen(rbac.ALL_PERMISSIONS)).toBe(true);
  });

  test('no built-in role holds a permission it should not', () => {
    expect(rbac.hasPermission('teacher', 'courses:write')).toBe(false);
    expect(rbac.hasPermission('student', 'courses:write')).toBe(false);
    expect(rbac.hasPermission('ghost', 'courses:read')).toBe(false);
  });

  test('admin holds them through the wildcard', () => {
    for (const permission of rbac.ALL_PERMISSIONS) {
      expect(rbac.hasPermission('admin', permission)).toBe(true);
    }
  });

  test('permissionsFor expands the wildcard against the vocabulary, not the roles', () => {
    // documents:read is granted to no built-in role, yet must still appear for
    // admin because the wildcard expands against the vocabulary.
    const adminPermissions = rbac.permissionsFor('admin');

    expect(adminPermissions).toContain('documents:read');
    expect(adminPermissions).toContain('certificates:write');
    expect(adminPermissions).not.toContain('*');
    expect(new Set(adminPermissions).size).toBe(adminPermissions.length);
  });

  test('permissionsFor returns the raw grants for a non-wildcard role', () => {
    expect(rbac.permissionsFor('teacher')).toEqual(rbac.rolePermissions.teacher);
    expect(rbac.permissionsFor('unknown-role')).toEqual([]);
  });
});