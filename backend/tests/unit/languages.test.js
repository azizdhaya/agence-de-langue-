const LanguageService = require('../../src/services/LanguageService');
const LanguageRepository = require('../../src/repositories/LanguageRepository');

describe('LanguageService', () => {
  test('should extend BaseService', () => {
    const BaseService = require('../../src/services/BaseService');
    expect(LanguageService instanceof BaseService).toBe(true);
  });

  test('should have findAllActive method', () => {
    expect(typeof LanguageService.findAllActive).toBe('function');
  });

  test('should have findByCode method', () => {
    expect(typeof LanguageService.findByCode).toBe('function');
  });

  test('should have all CRUD methods from BaseService', () => {
    expect(typeof LanguageService.findAll).toBe('function');
    expect(typeof LanguageService.findById).toBe('function');
    expect(typeof LanguageService.create).toBe('function');
    expect(typeof LanguageService.update).toBe('function');
    expect(typeof LanguageService.delete).toBe('function');
  });
});

describe('LanguageRepository', () => {
  const BaseRepository = require('../../src/repositories/BaseRepository');

  test('should extend BaseRepository', () => {
    expect(LanguageRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllActive method', () => {
    expect(typeof LanguageRepository.findAllActive).toBe('function');
  });

  test('should have findByCode method', () => {
    expect(typeof LanguageRepository.findByCode).toBe('function');
  });
});
