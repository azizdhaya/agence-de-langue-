const SessionService = require('../../src/services/SessionService');
const SessionRepository = require('../../src/repositories/SessionRepository');

describe('SessionService', () => {
  test('should extend BaseService', () => {
    const BaseService = require('../../src/services/BaseService');
    expect(SessionService instanceof BaseService).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof SessionService.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof SessionService.findByIdWithDetails).toBe('function');
  });

  test('should have findByGroup method', () => {
    expect(typeof SessionService.findByGroup).toBe('function');
  });

  test('should have findByDate method', () => {
    expect(typeof SessionService.findByDate).toBe('function');
  });
});

describe('SessionRepository', () => {
  const BaseRepository = require('../../src/repositories/BaseRepository');

  test('should extend BaseRepository', () => {
    expect(SessionRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof SessionRepository.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof SessionRepository.findByIdWithDetails).toBe('function');
  });

  test('should have findByGroup method', () => {
    expect(typeof SessionRepository.findByGroup).toBe('function');
  });

  test('should have findByDate method', () => {
    expect(typeof SessionRepository.findByDate).toBe('function');
  });
});
