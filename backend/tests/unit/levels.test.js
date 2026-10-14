const LevelService = require('../../src/services/LevelService');
const LevelRepository = require('../../src/repositories/LevelRepository');

describe('LevelService', () => {
  test('should extend BaseService', () => {
    const BaseService = require('../../src/services/BaseService');
    expect(LevelService instanceof BaseService).toBe(true);
  });

  test('should have findAllActive method', () => {
    expect(typeof LevelService.findAllActive).toBe('function');
  });

  test('should have findByCode method', () => {
    expect(typeof LevelService.findByCode).toBe('function');
  });

  test('should have findByLanguage method', () => {
    expect(typeof LevelService.findByLanguage).toBe('function');
  });
});

describe('LevelRepository', () => {
  const BaseRepository = require('../../src/repositories/BaseRepository');

  test('should extend BaseRepository', () => {
    expect(LevelRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllActive method', () => {
    expect(typeof LevelRepository.findAllActive).toBe('function');
  });

  test('should have findByCode method', () => {
    expect(typeof LevelRepository.findByCode).toBe('function');
  });

  test('should have findByLanguage method', () => {
    expect(typeof LevelRepository.findByLanguage).toBe('function');
  });
});
