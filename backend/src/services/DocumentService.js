const BaseService = require('./BaseService');
const documentRepository = require('../repositories/DocumentRepository');

class DocumentService extends BaseService {
  constructor() {
    super(documentRepository);
  }

  async findAllWithDetails(options = {}) {
    const { page = 1, limit = 10, search, type, userId, studentId } = options;
    const offset = (page - 1) * limit;
    const where = {};

    if (type) where.type = type;
    if (userId) where.user_id = userId;
    if (studentId) where.student_id = studentId;

    const [documents, total] = await Promise.all([
      this.repository.findAllWithDetails({ where, limit, offset, search }),
      this.repository.countWithFilters(where, search)
    ]);

    return {
      data: documents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findByIdWithDetails(id) {
    const document = await this.repository.findByIdWithDetails(id);
    if (!document) {
      throw new AppError('Document not found', 404, 'NOT_FOUND');
    }
    return document;
  }

  async findByUser(userId) {
    return await this.repository.findByUser(userId);
  }

  async findByStudent(studentId) {
    return await this.repository.findByStudent(studentId);
  }
}

module.exports = new DocumentService();
