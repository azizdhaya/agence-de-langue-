const BaseController = require('./BaseController');
const notificationService = require('../services/NotificationService');

class NotificationController extends BaseController {
  constructor() {
    super(notificationService);
  }

  async index(req, res, next) {
    try {
      // Non-admins only ever see their own notifications.
      if (req.user.role !== 'admin') {
        req.query.userId = req.user.id;
      }
      const result = await this.service.findAllWithDetails(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const notification = await this.service.findByIdWithDetails(req.params.id);

      // Non-admins can only view their own notifications.
      if (req.user.role !== 'admin' && notification.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied', code: 'FORBIDDEN' }
        });
      }

      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  async store(req, res, next) {
    try {
      const notification = await this.service.createNotification(req.body);
      res.status(201).json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  async mine(req, res, next) {
    try {
      const notifications = await this.service.findByUser(req.user.id, req.query.unreadOnly === 'true');
      const unreadCount = await this.service.countUnread(req.user.id);
      res.json({ success: true, data: notifications, unreadCount });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      // Ownership first: the previous order marked the row and only then
      // refused, so a student could flip anyone's notification (and, worse,
      // the check read user_id off a shapeless update result, refusing even
      // legitimate owners with a 403).
      const existing = await this.service.findByIdWithDetails(req.params.id);
      if (req.user.role !== 'admin' && existing.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied', code: 'FORBIDDEN' }
        });
      }

      const notification = await this.service.markAsRead(req.params.id);
      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await this.service.markAllAsRead(req.user.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();