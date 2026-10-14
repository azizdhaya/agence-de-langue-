const Joi = require('joi');

const schemas = {
  auth: {
    login: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required()
    }),
    register: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      role: Joi.string().valid('admin', 'teacher', 'student').required(),
      phone: Joi.string().allow('', null)
    })
  },
  student: {
    create: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      phone: Joi.string().allow('', null),
      dateOfBirth: Joi.date().allow('', null),
      address: Joi.string().allow('', null),
      emergencyContact: Joi.string().allow('', null),
      emergencyPhone: Joi.string().allow('', null),
      level: Joi.string().valid('beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced', 'proficient')
    }),
    update: Joi.object({
      firstName: Joi.string(),
      lastName: Joi.string(),
      phone: Joi.string().allow('', null),
      dateOfBirth: Joi.date().allow('', null),
      address: Joi.string().allow('', null),
      emergencyContact: Joi.string().allow('', null),
      emergencyPhone: Joi.string().allow('', null),
      level: Joi.string().valid('beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced', 'proficient'),
      status: Joi.string().valid('active', 'inactive', 'graduated', 'suspended')
    })
  },
  teacher: {
    create: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      phone: Joi.string().allow('', null),
      specialization: Joi.string().allow('', null),
      qualifications: Joi.string().allow('', null),
      bio: Joi.string().allow('', null),
      hourlyRate: Joi.number().min(0)
    }),
    update: Joi.object({
      firstName: Joi.string(),
      lastName: Joi.string(),
      phone: Joi.string().allow('', null),
      specialization: Joi.string().allow('', null),
      qualifications: Joi.string().allow('', null),
      bio: Joi.string().allow('', null),
      hourlyRate: Joi.number().min(0),
      status: Joi.string().valid('active', 'inactive', 'on_leave')
    })
  },
  course: {
    create: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow('', null),
      language: Joi.string().required(),
      level: Joi.string().required(),
      languageId: Joi.number().integer().allow(null),
      levelId: Joi.number().integer().allow(null),
      levelCode: Joi.string().allow(null),
      courseType: Joi.string().valid('generale', 'intensive', 'examen', 'professionnelle').allow('', null),
      mode: Joi.string().valid('presentiel', 'en_ligne', 'hybride').allow('', null),
      teacherId: Joi.number().integer().allow(null),
      maxStudents: Joi.number().integer().min(1),
      startDate: Joi.date().allow('', null),
      endDate: Joi.date().allow('', null),
      schedule: Joi.string().allow('', null),
      room: Joi.string().allow('', null),
      price: Joi.number().min(0).required(),
      status: Joi.string().valid('active', 'inactive', 'completed', 'cancelled')
    }),
    update: Joi.object({
      name: Joi.string(),
      description: Joi.string().allow('', null),
      language: Joi.string(),
      level: Joi.string(),
      languageId: Joi.number().integer().allow(null),
      levelId: Joi.number().integer().allow(null),
      levelCode: Joi.string().allow(null),
      courseType: Joi.string().valid('generale', 'intensive', 'examen', 'professionnelle').allow('', null),
      mode: Joi.string().valid('presentiel', 'en_ligne', 'hybride').allow('', null),
      teacherId: Joi.number().integer().allow(null),
      maxStudents: Joi.number().integer().min(1),
      startDate: Joi.date().allow('', null),
      endDate: Joi.date().allow('', null),
      schedule: Joi.string().allow('', null),
      room: Joi.string().allow('', null),
      price: Joi.number().min(0),
      status: Joi.string().valid('active', 'inactive', 'completed', 'cancelled')
    }),
    enroll: Joi.object({
      studentId: Joi.number().integer().required(),
      groupId: Joi.number().integer().allow(null),
      confirmed: Joi.boolean().default(false),
      // Modules to register the student to: each one's active submodules become
      // charges. priceOverrides maps a submoduleId to a per-enrolment price.
      moduleIds: Joi.array().items(Joi.number().integer()).default([]),
      priceOverrides: Joi.object().pattern(/^\d+$/, Joi.number().min(0)).default({})
    })
  },
  message: {
    create: Joi.object({
      receiverId: Joi.number().integer().required(),
      content: Joi.string().trim().min(1).max(2000).required()
    })
  },
  module: {
    create: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow('', null),
      position: Joi.number().integer().min(0),
      discountPercent: Joi.number().min(0).max(100),
      status: Joi.string().valid('active', 'inactive')
    }),
    update: Joi.object({
      name: Joi.string(),
      description: Joi.string().allow('', null),
      position: Joi.number().integer().min(0),
      discountPercent: Joi.number().min(0).max(100),
      status: Joi.string().valid('active', 'inactive')
    })
  },
  submodule: {
    create: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow('', null),
      position: Joi.number().integer().min(0),
      price: Joi.number().min(0).required(),
      status: Joi.string().valid('active', 'inactive')
    }),
    update: Joi.object({
      name: Joi.string(),
      description: Joi.string().allow('', null),
      position: Joi.number().integer().min(0),
      price: Joi.number().min(0),
      status: Joi.string().valid('active', 'inactive')
    })
  },
  payment: {
    // Settle submodules (one at a time) or whole modules (with an optional
    // whole-module discount), all in a single payment.
    create: Joi.object({
      method: Joi.string().valid('cash', 'card', 'transfer', 'check', 'other').default('cash'),
      reference: Joi.string().allow('', null),
      note: Joi.string().allow('', null),
      paidAt: Joi.date().allow(null),
      items: Joi.array().items(
        Joi.object({
          enrollmentModuleId: Joi.number().integer().positive(),
          enrollmentSubmoduleId: Joi.number().integer().positive(),
          discountPercent: Joi.number().min(0).max(100)
        }).or('enrollmentModuleId', 'enrollmentSubmoduleId')
      ).min(1).required()
    })
  },
  attendance: {
    create: Joi.object({
      studentId: Joi.number().integer().required(),
      courseId: Joi.number().integer().required(),
      date: Joi.date().required(),
      status: Joi.string().valid('present', 'absent', 'late', 'excused').required(),
      notes: Joi.string().allow('', null)
    }),
    bulk: Joi.object({
      courseId: Joi.number().integer().required(),
      date: Joi.date().required(),
      attendanceData: Joi.array().items(
        Joi.object({
          studentId: Joi.number().integer().required(),
          status: Joi.string().valid('present', 'absent', 'late', 'excused').required(),
          notes: Joi.string().allow('', null)
        })
      ).required()
    })
  },
  grade: {
    create: Joi.object({
      studentId: Joi.number().integer().required(),
      courseId: Joi.number().integer().required(),
      assessmentType: Joi.string().required(),
      score: Joi.number().min(0).required(),
      maxScore: Joi.number().min(1).default(100),
      notes: Joi.string().allow('', null)
    })
  },
  announcement: {
    create: Joi.object({
      title: Joi.string().required(),
      content: Joi.string().required(),
      targetAudience: Joi.string().valid('all', 'students', 'teachers'),
      priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
      expiresAt: Joi.date().allow('', null)
    })
  },
  language: {
    create: Joi.object({
      code: Joi.string().required(),
      name: Joi.string().required(),
      flag: Joi.string().allow('', null),
      isActive: Joi.boolean()
    }),
    update: Joi.object({
      code: Joi.string(),
      name: Joi.string(),
      flag: Joi.string().allow('', null),
      isActive: Joi.boolean()
    })
  },
  level: {
    create: Joi.object({
      code: Joi.string().required(),
      name: Joi.string().required(),
      description: Joi.string().allow('', null),
      orderIndex: Joi.number().integer().required(),
      parentCode: Joi.string().allow('', null),
      framework: Joi.string().default('CEFR'),
      languageId: Joi.number().integer().allow(null),
      durationHours: Joi.number().integer().min(1),
      prerequisites: Joi.string().allow('', null),
      isActive: Joi.boolean()
    }),
    update: Joi.object({
      code: Joi.string(),
      name: Joi.string(),
      description: Joi.string().allow('', null),
      orderIndex: Joi.number().integer(),
      parentCode: Joi.string().allow('', null),
      framework: Joi.string(),
      languageId: Joi.number().integer().allow(null),
      durationHours: Joi.number().integer().min(1),
      prerequisites: Joi.string().allow('', null),
      isActive: Joi.boolean()
    })
  },
  placementBand: {
    update: Joi.object({
      minScore: Joi.number().min(0).max(100),
      maxScore: Joi.number().min(0).max(100),
      levelCode: Joi.string(),
      isActive: Joi.boolean()
    })
  },
  studentLanguage: {
    levelCode: Joi.string(),
    create: Joi.object({
      languageId: Joi.number().integer().required(),
      globalLevelCode: Joi.string().allow(null),
      levelCode: Joi.string().allow(null),
      listeningLevelCode: Joi.string().allow(null),
      readingLevelCode: Joi.string().allow(null),
      speakingLevelCode: Joi.string().allow(null),
      writingLevelCode: Joi.string().allow(null),
      method: Joi.string().valid('placement_test', 'teacher_assessment', 'exam', 'certificate', 'self_assessment', 'admin_adjustment'),
      assessmentMethod: Joi.string().valid('placement_test', 'teacher_assessment', 'exam', 'certificate', 'self_assessment', 'admin_adjustment'),
      score: Joi.number().min(0).max(100).allow(null),
      assessmentScore: Joi.number().min(0).max(100).allow(null),
      assessedAt: Joi.date().allow(null),
      reason: Joi.string().allow('', null)
    }),
    update: Joi.object({
      globalLevelCode: Joi.string().allow(null),
      levelCode: Joi.string().allow(null),
      listeningLevelCode: Joi.string().allow(null),
      readingLevelCode: Joi.string().allow(null),
      speakingLevelCode: Joi.string().allow(null),
      writingLevelCode: Joi.string().allow(null),
      method: Joi.string().valid('placement_test', 'teacher_assessment', 'exam', 'certificate', 'self_assessment', 'admin_adjustment'),
      assessmentMethod: Joi.string().valid('placement_test', 'teacher_assessment', 'exam', 'certificate', 'self_assessment', 'admin_adjustment'),
      score: Joi.number().min(0).max(100).allow(null),
      assessmentScore: Joi.number().min(0).max(100).allow(null),
      assessedAt: Joi.date().allow(null),
      reason: Joi.string().allow('', null)
    }),
    assess: Joi.object({
      scores: Joi.object({
        listening: Joi.number().min(0).max(100),
        reading: Joi.number().min(0).max(100),
        speaking: Joi.number().min(0).max(100),
        writing: Joi.number().min(0).max(100)
      }).required(),
      overallScore: Joi.number().min(0).max(100),
      method: Joi.string().valid('placement_test', 'teacher_assessment', 'exam', 'certificate', 'self_assessment', 'admin_adjustment'),
      reason: Joi.string().allow('', null)
    })
  },
  skill: {
    create: Joi.object({
      code: Joi.string().required(),
      name: Joi.string().required(),
      description: Joi.string().allow('', null),
      isActive: Joi.boolean()
    }),
    update: Joi.object({
      code: Joi.string(),
      name: Joi.string(),
      description: Joi.string().allow('', null),
      isActive: Joi.boolean()
    })
  },
  group: {
    create: Joi.object({
      name: Joi.string().required(),
      courseId: Joi.number().integer().required(),
      teacherId: Joi.number().integer().allow(null),
      room: Joi.string().allow('', null),
      maxStudents: Joi.number().integer().min(1),
      startDate: Joi.date().allow('', null),
      endDate: Joi.date().allow('', null),
      schedule: Joi.string().allow('', null),
      status: Joi.string().valid('active', 'inactive', 'completed', 'cancelled')
    }),
    update: Joi.object({
      name: Joi.string(),
      courseId: Joi.number().integer(),
      teacherId: Joi.number().integer().allow(null),
      room: Joi.string().allow('', null),
      maxStudents: Joi.number().integer().min(1),
      startDate: Joi.date().allow('', null),
      endDate: Joi.date().allow('', null),
      schedule: Joi.string().allow('', null),
      status: Joi.string().valid('active', 'inactive', 'completed', 'cancelled')
    })
  },
  session: {
    create: Joi.object({
      groupId: Joi.number().integer().required(),
      teacherId: Joi.number().integer().allow(null),
      room: Joi.string().allow('', null),
      date: Joi.date().required(),
      startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
      endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
      submoduleId: Joi.number().integer().allow(null),
      status: Joi.string().valid('scheduled', 'completed', 'cancelled', 'postponed'),
      notes: Joi.string().allow('', null)
    }),
    update: Joi.object({
      groupId: Joi.number().integer(),
      teacherId: Joi.number().integer().allow(null),
      room: Joi.string().allow('', null),
      date: Joi.date(),
      startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
      submoduleId: Joi.number().integer().allow(null),
      status: Joi.string().valid('scheduled', 'completed', 'cancelled', 'postponed'),
      notes: Joi.string().allow('', null)
    })
  },
  certificate: {
    create: Joi.object({
      studentId: Joi.number().integer().required(),
      courseId: Joi.number().integer().allow(null),
      level: Joi.string().required(),
      score: Joi.number().min(0).allow(null),
      expiryDate: Joi.date().allow('', null)
    }),
    update: Joi.object({
      level: Joi.string(),
      score: Joi.number().min(0).allow(null),
      expiryDate: Joi.date().allow('', null),
      status: Joi.string().valid('active', 'revoked', 'expired')
    })
  },
  document: {
    create: Joi.object({
      userId: Joi.number().integer().required(),
      studentId: Joi.number().integer().allow(null),
      name: Joi.string().required(),
      type: Joi.string().valid('contract', 'id', 'certificate', 'transcript', 'other').required(),
      filePath: Joi.string().required(),
      fileSize: Joi.number().integer().allow(null),
      mimeType: Joi.string().allow('', null)
    }),
    update: Joi.object({
      name: Joi.string(),
      type: Joi.string().valid('contract', 'id', 'certificate', 'transcript', 'other')
    })
  },
  notification: {
    create: Joi.object({
      userId: Joi.number().integer().required(),
      title: Joi.string().required(),
      message: Joi.string().required(),
      type: Joi.string().valid('info', 'warning', 'success', 'error').default('info'),
      link: Joi.string().allow('', null)
    })
  }
};

module.exports = schemas;
