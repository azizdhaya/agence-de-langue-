const AppError = require('../errors/AppError');

class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  async findAll(options = {}) {
    return await this.repository.findAll(options);
  }

  async findById(id) {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new AppError('Resource not found', 404, 'NOT_FOUND');
    }
    return item;
  }

  async create(data) {
    return await this.repository.create(data);
  }

  async update(id, data) {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new AppError('Resource not found', 404, 'NOT_FOUND');
    }
    return await this.repository.update(id, data);
  }

  async delete(id) {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new AppError('Resource not found', 404, 'NOT_FOUND');
    }
    return await this.repository.delete(id);
  }
}

module.exports = BaseService;
