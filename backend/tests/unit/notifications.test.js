const NotificationService = require('../../src/services/NotificationService');
const NotificationRepository = require('../../src/repositories/NotificationRepository');

describe('NotificationService', () => {
  test('should extend BaseService', () => {
    const BaseService = require('../../src/services/BaseService');
    expect(NotificationService instanceof BaseService).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof NotificationService.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof NotificationService.findByIdWithDetails).toBe('function');
  });

  test('should have findByUser method', () => {
    expect(typeof NotificationService.findByUser).toBe('function');
  });

  test('should have markAsRead method', () => {
    expect(typeof NotificationService.markAsRead).toBe('function');
  });

  test('should have markAllAsRead method', () => {
    expect(typeof NotificationService.markAllAsRead).toBe('function');
  });

  test('should have countUnread method', () => {
    expect(typeof NotificationService.countUnread).toBe('function');
  });

  test('should have createNotification method', () => {
    expect(typeof NotificationService.createNotification).toBe('function');
  });

  test('should have notifyUsers method', () => {
    expect(typeof NotificationService.notifyUsers).toBe('function');
  });

  test('should have notifyRole method', () => {
    expect(typeof NotificationService.notifyRole).toBe('function');
  });
});

describe('NotificationRepository', () => {
  const BaseRepository = require('../../src/repositories/BaseRepository');

  test('should extend BaseRepository', () => {
    expect(NotificationRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof NotificationRepository.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof NotificationRepository.findByIdWithDetails).toBe('function');
  });

  test('should have findByUser method', () => {
    expect(typeof NotificationRepository.findByUser).toBe('function');
  });

  test('should have markAsRead method', () => {
    expect(typeof NotificationRepository.markAsRead).toBe('function');
  });

  test('should have markAllAsRead method', () => {
    expect(typeof NotificationRepository.markAllAsRead).toBe('function');
  });

  test('should have countUnread method', () => {
    expect(typeof NotificationRepository.countUnread).toBe('function');
  });
});