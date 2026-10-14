const BaseService = require('./BaseService');
const notificationRepository = require('../repositories/NotificationRepository');
const AppError = require('../errors/AppError');

class NotificationService extends BaseService {
  constructor() {
    super(notificationRepository);
  }

  async findAllWithDetails(options = {}) {
    const { page = 1, limit = 10, search, type, userId, isRead } = options;
    const offset = (page - 1) * limit;
    const where = {};

    if (type) where.type = type;
    if (userId) where.user_id = userId;
    if (isRead !== undefined) where.is_read = isRead;

    const [notifications, total] = await Promise.all([
      this.repository.findAllWithDetails({ where, limit, offset, search }),
      this.repository.countWithFilters(where, search)
    ]);

    return {
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findByIdWithDetails(id) {
    const notification = await this.repository.findByIdWithDetails(id);
    if (!notification) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }
    return notification;
  }

  async findByUser(userId, unreadOnly = false) {
    return await this.repository.findByUser(userId, unreadOnly);
  }

  async markAsRead(id) {
    const notification = await this.repository.findById(id);
    if (!notification) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }
    await this.repository.markAsRead(id);
    // Full row (snake_case, user_id included): callers check ownership on it.
    return await this.findByIdWithDetails(id);
  }

  async markAllAsRead(userId) {
    return await this.repository.markAllAsRead(userId);
  }

  async countUnread(userId) {
    return await this.repository.countUnread(userId);
  }

  async createNotification(data) {
    return await this.repository.create({
      ...data,
      is_read: 0,
      type: data.type || 'info'
    });
  }

  // Helper: notify multiple users
  async notifyUsers(userIds, notification) {
    const results = [];
    for (const userId of userIds) {
      results.push(await this.createNotification({ ...notification, userId }));
    }
    return results;
  }

  // Helper: notify by role
  async notifyRole(role, notification, db) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id FROM users WHERE role = ?',
        [role],
        async (err, users) => {
          if (err) {
            reject(err);
            return;
          }
          try {
            const userIds = users.map(u => u.id);
            const results = await this.notifyUsers(userIds, notification);
            resolve(results);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }
}

module.exports = new NotificationService();