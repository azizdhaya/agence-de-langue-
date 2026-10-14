const BaseController = require('../../src/controllers/BaseController');
const StudentController = require('../../src/controllers/StudentController');
const CourseController = require('../../src/controllers/CourseController');

describe('BaseController', () => {
  let controller;

  beforeEach(() => {
    const mockService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    controller = new BaseController(mockService);
  });

  test('should have all CRUD methods', () => {
    expect(typeof controller.index).toBe('function');
    expect(typeof controller.show).toBe('function');
    expect(typeof controller.store).toBe('function');
    expect(typeof controller.update).toBe('function');
    expect(typeof controller.destroy).toBe('function');
  });

  test('should call service findAll in index', async () => {
    const req = { query: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await controller.index(req, res, next);
    expect(controller.service.findAll).toHaveBeenCalled();
  });

  test('should call service findById in show', async () => {
    const req = { params: { id: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await controller.show(req, res, next);
    expect(controller.service.findById).toHaveBeenCalledWith(1);
  });
});

describe('StudentController', () => {
  test('should extend BaseController', () => {
    expect(StudentController instanceof BaseController).toBe(true);
  });

  test('should have custom index method', () => {
    expect(typeof StudentController.index).toBe('function');
  });

  test('should have custom show method', () => {
    expect(typeof StudentController.show).toBe('function');
  });
});

describe('CourseController', () => {
  test('should extend BaseController', () => {
    expect(CourseController instanceof BaseController).toBe(true);
  });

  test('should have custom index method', () => {
    expect(typeof CourseController.index).toBe('function');
  });

  test('should have custom show method', () => {
    expect(typeof CourseController.show).toBe('function');
  });
});
