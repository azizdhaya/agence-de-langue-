const BaseService = require('./BaseService');
const skillRepository = require('../repositories/SkillRepository');

class SkillService extends BaseService {
  constructor() {
    super(skillRepository);
  }

  async findAllActive() {
    return await this.repository.findAllActive();
  }

  async findByCode(code) {
    return await this.repository.findByCode(code);
  }
}

module.exports = new SkillService();
