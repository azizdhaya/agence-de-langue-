const BaseService = require('./BaseService');
const certificateRepository = require('../repositories/CertificateRepository');
const db = require('../models/database');
const AppError = require('../errors/AppError');

class CertificateService extends BaseService {
  constructor() {
    super(certificateRepository);
  }

  async findAllWithDetails(options = {}) {
    const { page = 1, limit = 10, search, status } = options;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;

    const [certificates, total] = await Promise.all([
      this.repository.findAllWithDetails({ where, limit, offset, search }),
      this.repository.countWithFilters(where, search)
    ]);

    return {
      data: certificates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findByIdWithDetails(id) {
    const certificate = await this.repository.findByIdWithDetails(id);
    if (!certificate) {
      throw new AppError('Certificate not found', 404, 'NOT_FOUND');
    }
    return certificate;
  }

  async createCertificate(data) {
    const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const verificationUrl = `/verify/certificate/${certificateNumber}`;

    // A raw users-table id here failed with a bare SQLITE_CONSTRAINT on the
    // FK; resolve user-first and fail with a proper 404 instead.
    const { StudentLanguageService } = require('./StudentLanguageService');
    const studentId = await StudentLanguageService.resolveStudentId(data.studentId);

    if (data.courseId !== undefined && data.courseId !== null) {
      const { get } = require('../utils/dbHelpers');
      const course = await get('SELECT id FROM courses WHERE id = ?', [Number(data.courseId)]);
      if (!course) {
        throw new AppError('Course not found', 404, 'NOT_FOUND');
      }
    }

    const { studentId: _rawStudentId, ...rest } = data;
    return await this.repository.create({
      ...rest,
      student_id: studentId,
      certificate_number: certificateNumber,
      verification_url: verificationUrl,
      status: 'active'
    });
  }

  async verifyCertificate(certNumber) {
    // Use the joined query so the response includes the student and course names
    const row = await new Promise((resolve, reject) => {
      db.get(
        `SELECT c.*, u.first_name || ' ' || u.last_name as student_name, u.email as student_email,
                co.name as course_name
         FROM certificates c
         JOIN students s ON c.student_id = s.id
         JOIN users u ON s.user_id = u.id
         LEFT JOIN courses co ON c.course_id = co.id
         WHERE c.certificate_number = ?`,
        [certNumber],
        (err, result) => (err ? reject(err) : resolve(result))
      );
    });

    if (!row) {
      throw new AppError('Certificate not found', 404, 'NOT_FOUND');
    }
    if (row.status !== 'active') {
      throw new AppError('Certificate is not valid', 400, 'INVALID_CERTIFICATE');
    }

    const BaseRepository = require('../repositories/BaseRepository');
    return BaseRepository.toCamelCase(row);
  }
}

module.exports = new CertificateService();
