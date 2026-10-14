const BaseRepository = require('./BaseRepository');

class SkillRepository extends BaseRepository {
  constructor() {
    super('skills');
  }

  async findAllActive() {
    return this.findAll({ where: { is_active: 1 } });
  }

  async findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = new SkillRepository();
