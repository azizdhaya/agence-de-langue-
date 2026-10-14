const DocumentService = require('../../src/services/DocumentService');
const DocumentRepository = require('../../src/repositories/DocumentRepository');

describe('DocumentService', () => {
  test('should extend BaseService', () => {
    const BaseService = require('../../src/services/BaseService');
    expect(DocumentService instanceof BaseService).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof DocumentService.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof DocumentService.findByIdWithDetails).toBe('function');
  });

  test('should have findByUser method', () => {
    expect(typeof DocumentService.findByUser).toBe('function');
  });

  test('should have findByStudent method', () => {
    expect(typeof DocumentService.findByStudent).toBe('function');
  });
});

describe('DocumentRepository', () => {
  const BaseRepository = require('../../src/repositories/BaseRepository');

  test('should extend BaseRepository', () => {
    expect(DocumentRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof DocumentRepository.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof DocumentRepository.findByIdWithDetails).toBe('function');
  });

  test('should have findByUser method', () => {
    expect(typeof DocumentRepository.findByUser).toBe('function');
  });

  test('should have findByStudent method', () => {
    expect(typeof DocumentRepository.findByStudent).toBe('function');
  });

  test('should have countWithFilters method', () => {
    expect(typeof DocumentRepository.countWithFilters).toBe('function');
  });
});
