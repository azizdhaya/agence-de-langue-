const BaseService = require('./BaseService');
const studentRepository = require('../repositories/StudentRepository');
const db = require('../models/database');

class StudentService extends BaseService {
  constructor() {
    super(studentRepository);
  }

  async findAllWithUsers(options = {}) {
    const { page = 1, limit = 10, search, status, level } = options;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (level) where.level = level;

    const [students, total] = await Promise.all([
      this.repository.findAllWithUsers({ where, limit, offset, search }),
      this.repository.countWithFilters(where, search)
    ]);

    return {
      data: students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findByIdWithUser(id) {
    const student = await this.repository.findByIdWithUser(id);
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }
    return student;
  }

  async findByUserId(userId) {
    const student = await this.repository.findByUserId(userId);
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }
    return student;
  }

  async createStudent(userData, studentData) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `INSERT INTO users (email, password, first_name, last_name, role, phone)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userData.email, userData.password, userData.firstName, userData.lastName, 'student', userData.phone],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            const userId = this.lastID;

            db.run(
              `INSERT INTO students (user_id, date_of_birth, address, emergency_contact, emergency_phone, level)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [userId, studentData.dateOfBirth, studentData.address, studentData.emergencyContact, studentData.emergencyPhone, studentData.level],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                db.run('COMMIT');
                resolve({ id: userId, ...userData, ...studentData });
              }
            );
          }
        );
      });
    });
  }

  async updateStudent(id, userData, studentData) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [userData.firstName, userData.lastName, userData.phone, id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            db.run(
              `UPDATE students SET date_of_birth = ?, address = ?, emergency_contact = ?, emergency_phone = ?, level = ?, status = ? WHERE user_id = ?`,
              [studentData.dateOfBirth, studentData.address, studentData.emergencyContact, studentData.emergencyPhone, studentData.level, studentData.status, id],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                db.run('COMMIT');
                resolve({ id, ...userData, ...studentData });
              }
            );
          }
        );
      });
    });
  }
}

module.exports = new StudentService();
