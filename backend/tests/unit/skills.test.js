const SkillService = require('../../src/services/SkillService');
const SkillRepository = require('../../src/repositories/SkillRepository');

describe('SkillService', () => {
  test('should extend BaseService', () => {
    const BaseService = require('../../src/services/BaseService');
    expect(SkillService instanceof BaseService).toBe(true);
  });

  test('should have findAllActive method', () => {
    expect(typeof SkillService.findAllActive).toBe('function');
  });

  test('should have findByCode method', () => {
    expect(typeof SkillService.findByCode).toBe('function');
  });
});

describe('SkillRepository', () => {
  const BaseRepository = require('../../src/repositories/BaseRepository');

  test('should extend BaseRepository', () => {
    expect(SkillRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllActive method', () => {
    expect(typeof SkillRepository.findAllActive).toBe('function');
  });

  test('should have findByCode method', () => {
    expect(typeof SkillRepository.findByCode).toBe('function');
  });
});
