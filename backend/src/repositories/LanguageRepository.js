const BaseRepository = require('./BaseRepository');

class LanguageRepository extends BaseRepository {
  constructor() {
    super('languages');
  }

  async findAllActive() {
    return this.findAll({ where: { is_active: 1 } });
  }

  async findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = new LanguageRepository();
