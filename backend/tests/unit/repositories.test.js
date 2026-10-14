const BaseRepository = require('../../src/repositories/BaseRepository');
const StudentRepository = require('../../src/repositories/StudentRepository');
const CourseRepository = require('../../src/repositories/CourseRepository');

describe('BaseRepository', () => {
  let repository;

  beforeEach(() => {
    repository = new BaseRepository('test_table');
  });

  test('should create repository with table name', () => {
    expect(repository.tableName).toBe('test_table');
  });

  test('should have all CRUD methods', () => {
    expect(typeof repository.findAll).toBe('function');
    expect(typeof repository.findById).toBe('function');
    expect(typeof repository.findOne).toBe('function');
    expect(typeof repository.create).toBe('function');
    expect(typeof repository.update).toBe('function');
    expect(typeof repository.delete).toBe('function');
    expect(typeof repository.count).toBe('function');
  });
});

describe('StudentRepository', () => {
  test('should extend BaseRepository', () => {
    expect(StudentRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllWithUsers method', () => {
    expect(typeof StudentRepository.findAllWithUsers).toBe('function');
  });

  test('should have findByIdWithUser method', () => {
    expect(typeof StudentRepository.findByIdWithUser).toBe('function');
  });

  test('should have findByUserId method', () => {
    expect(typeof StudentRepository.findByUserId).toBe('function');
  });

  test('should have countWithFilters method', () => {
    expect(typeof StudentRepository.countWithFilters).toBe('function');
  });
});

describe('CourseRepository', () => {
  test('should extend BaseRepository', () => {
    expect(CourseRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof CourseRepository.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof CourseRepository.findByIdWithDetails).toBe('function');
  });

  test('should have countWithFilters method', () => {
    expect(typeof CourseRepository.countWithFilters).toBe('function');
  });
});
