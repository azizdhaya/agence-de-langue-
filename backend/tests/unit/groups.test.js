const GroupService = require('../../src/services/GroupService');
const GroupRepository = require('../../src/repositories/GroupRepository');

describe('GroupService', () => {
  test('should extend BaseService', () => {
    const BaseService = require('../../src/services/BaseService');
    expect(GroupService instanceof BaseService).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof GroupService.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof GroupService.findByIdWithDetails).toBe('function');
  });
});

describe('GroupRepository', () => {
  const BaseRepository = require('../../src/repositories/BaseRepository');

  test('should extend BaseRepository', () => {
    expect(GroupRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof GroupRepository.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof GroupRepository.findByIdWithDetails).toBe('function');
  });

  test('should have countWithFilters method', () => {
    expect(typeof GroupRepository.countWithFilters).toBe('function');
  });
});
