const BaseService = require('../../src/services/BaseService');
const StudentService = require('../../src/services/StudentService');
const CourseService = require('../../src/services/CourseService');

describe('BaseService', () => {
  let service;

  beforeEach(() => {
    const mockRepository = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
      create: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
      update: jest.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
      delete: jest.fn().mockResolvedValue({ deleted: true })
    };
    service = new BaseService(mockRepository);
  });

  test('should have all CRUD methods', () => {
    expect(typeof service.findAll).toBe('function');
    expect(typeof service.findById).toBe('function');
    expect(typeof service.create).toBe('function');
    expect(typeof service.update).toBe('function');
    expect(typeof service.delete).toBe('function');
  });

  test('should call repository findAll', async () => {
    await service.findAll();
    expect(service.repository.findAll).toHaveBeenCalled();
  });

  test('should call repository findById', async () => {
    const result = await service.findById(1);
    expect(service.repository.findById).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1, name: 'Test' });
  });

  test('should throw error when resource not found', async () => {
    service.repository.findById.mockResolvedValue(null);
    await expect(service.findById(1)).rejects.toThrow('Resource not found');
  });

  test('should call repository create', async () => {
    const data = { name: 'Test' };
    await service.create(data);
    expect(service.repository.create).toHaveBeenCalledWith(data);
  });

  test('should call repository update', async () => {
    const data = { name: 'Updated' };
    await service.update(1, data);
    expect(service.repository.update).toHaveBeenCalledWith(1, data);
  });

  test('should call repository delete', async () => {
    await service.delete(1);
    expect(service.repository.delete).toHaveBeenCalledWith(1);
  });
});

describe('StudentService', () => {
  test('should extend BaseService', () => {
    expect(StudentService instanceof BaseService).toBe(true);
  });

  test('should have findAllWithUsers method', () => {
    expect(typeof StudentService.findAllWithUsers).toBe('function');
  });

  test('should have findByIdWithUser method', () => {
    expect(typeof StudentService.findByIdWithUser).toBe('function');
  });

  test('should have findByUserId method', () => {
    expect(typeof StudentService.findByUserId).toBe('function');
  });

  test('should have createStudent method', () => {
    expect(typeof StudentService.createStudent).toBe('function');
  });

  test('should have updateStudent method', () => {
    expect(typeof StudentService.updateStudent).toBe('function');
  });
});

describe('CourseService', () => {
  test('should extend BaseService', () => {
    expect(CourseService instanceof BaseService).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof CourseService.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof CourseService.findByIdWithDetails).toBe('function');
  });
});
