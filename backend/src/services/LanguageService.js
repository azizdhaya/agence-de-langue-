const BaseService = require('./BaseService');
const languageRepository = require('../repositories/LanguageRepository');

class LanguageService extends BaseService {
  constructor() {
    super(languageRepository);
  }

  async findAllActive() {
    return await this.repository.findAllActive();
  }

  async findByCode(code) {
    return await this.repository.findByCode(code);
  }
}

module.exports = new LanguageService();
