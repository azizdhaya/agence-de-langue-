const studentLanguageRepository = require('../repositories/StudentLanguageRepository');
const levelRepository = require('../repositories/LevelRepository');
const { get } = require('../utils/dbHelpers');
const AppError = require('../errors/AppError');

/** Request skill names -> student_languages columns. */
const SKILL_COLUMNS = Object.freeze({
  listening: 'listening_level_id',
  reading: 'reading_level_id',
  speaking: 'speaking_level_id',
  writing: 'writing_level_id'
});

/** Assessment methods the API accepts. */
const ASSESSMENT_METHODS = Object.freeze([
  'placement_test', 'teacher_assessment', 'exam', 'certificate', 'self_assessment', 'admin_adjustment'
]);

class StudentLanguageService {
  /** All language profiles of a student, with level codes joined. */
  async findByStudent(studentId) {
    const id = await StudentLanguageService.resolveStudentId(studentId);
    return await studentLanguageRepository.findByStudent(id);
  }

  /** One profile (student + language), with level codes joined. */
  async findOne(studentId, languageId) {
    const id = await StudentLanguageService.resolveStudentId(studentId);
    const profile = await studentLanguageRepository.findByStudentAndLanguage(id, Number(languageId));
    if (!profile) {
      throw new AppError('No profile for this student and language', 404, 'NOT_FOUND');
    }
    return profile;
  }

  /**
   * Create the profile for a student learning a language.
   * The global level may be omitted (unknown until the first assessment);
   * per-skill levels may differ from it (§11).
   */
  async createProfile(studentId, data, createdBy = null) {
    const id = await StudentLanguageService.resolveStudentId(studentId);
    const languageId = StudentLanguageService.requireId(data.languageId, 'languageId');
    await StudentLanguageService.assertLanguage(languageId);

    const existing = await studentLanguageRepository.findByStudentAndLanguage(id, languageId);
    if (existing) {
      throw new AppError('This student already has a profile for this language', 409, 'PROFILE_EXISTS');
    }

    const levelIds = await StudentLanguageService.resolveLevelCodes(data);
    const profile = {
      student_id: id,
      language_id: languageId,
      global_level_id: levelIds.global ?? null,
      listening_level_id: levelIds.listening ?? null,
      reading_level_id: levelIds.reading ?? null,
      speaking_level_id: levelIds.speaking ?? null,
      writing_level_id: levelIds.writing ?? null,
      assessment_method: data.method ?? data.assessmentMethod ?? null,
      assessment_score: data.score ?? data.assessmentScore ?? null,
      assessed_at: data.assessedAt ?? new Date().toISOString()
    };
    if (profile.assessment_method) {
      StudentLanguageService.assertMethod(profile.assessment_method);
    }

    const createdId = await studentLanguageRepository.createWithHistory(profile, {
      old_level_id: null,
      new_level_id: profile.global_level_id,
      changed_by: createdBy,
      reason: data.reason ?? 'Initial assessment',
      method: profile.assessment_method,
      score: profile.assessment_score
    });

    return await studentLanguageRepository.findByStudentAndLanguage(id, languageId);
  }

  /**
   * Update a profile. When the global level changes, the old level is kept in
   * `level_history` — never overwritten (§10).
   */
  async updateProfile(studentId, languageId, data, updatedBy = null) {
    const existing = await this.findOne(studentId, languageId);

    const patch = {};
    const levelIds = await StudentLanguageService.resolveLevelCodes(data, { allowMissing: true });
    for (const [skill, column] of Object.entries({ global: 'global_level_id', ...SKILL_COLUMNS })) {
      if (levelIds[skill] !== undefined) patch[column] = levelIds[skill];
    }
    for (const [input, column] of Object.entries({ method: 'assessment_method', assessmentMethod: 'assessment_method', score: 'assessment_score', assessmentScore: 'assessment_score', assessedAt: 'assessed_at' })) {
      if (data[input] !== undefined) patch[column] = data[input];
    }
    if (patch.assessment_method) StudentLanguageService.assertMethod(patch.assessment_method);

    const globalChanged = patch.global_level_id !== undefined && patch.global_level_id !== existing.global_level_id;

    await studentLanguageRepository.updateWithHistory(existing.id, patch, globalChanged ? {
      old_level_id: existing.global_level_id,
      new_level_id: patch.global_level_id,
      changed_by: updatedBy,
      reason: data.reason ?? 'Level update',
      method: patch.assessment_method ?? existing.assessment_method,
      score: patch.assessment_score ?? existing.assessment_score
    } : null);

    return await this.findOne(studentId, languageId);
  }

  /** Full change history of one profile, newest first. */
  async history(studentId, languageId) {
    const profile = await this.findOne(studentId, languageId);
    return await studentLanguageRepository.findHistory(profile.id);
  }

  /**
   * Run a placement assessment: one score per skill (0-100), each mapped
   * through the configurable `placement_bands` to a CEFR level. The global
   * level becomes the lowest of the four skill levels — a student is placed
   * where they are weakest, not where they shine.
   */
  async assess(studentId, languageId, data, assessedBy = null) {
    const profile = await this.findOne(studentId, languageId);

    const scores = data.scores || {};
    const skills = Object.keys(SKILL_COLUMNS);
    const assessed = {};
    for (const skill of skills) {
      if (scores[skill] === undefined || scores[skill] === null) continue;
      const score = Number(scores[skill]);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        throw new AppError(`Invalid score for ${skill}: expected 0-100`, 400, 'INVALID_SCORE');
      }
      assessed[skill] = await StudentLanguageService.levelForScore(score);
    }
    if (Object.keys(assessed).length === 0) {
      throw new AppError('At least one skill score is required', 400, 'SCORES_REQUIRED');
    }

    const method = data.method || 'placement_test';
    StudentLanguageService.assertMethod(method);

    // Global = weakest skill, by CEFR order (findById returns camelCase).
    let globalId = null;
    let weakestOrder = Infinity;
    for (const skill of Object.keys(assessed)) {
      const level = await levelRepository.findById(assessed[skill]);
      if (level && level.orderIndex < weakestOrder) {
        weakestOrder = level.orderIndex;
        globalId = level.id;
      }
    }

    const patch = { assessment_method: method, assessed_at: new Date().toISOString() };
    if (data.overallScore !== undefined) patch.assessment_score = Number(data.overallScore);
    for (const [skill, column] of Object.entries(SKILL_COLUMNS)) {
      if (assessed[skill] !== undefined) patch[column] = assessed[skill];
    }
    if (globalId) patch.global_level_id = globalId;

    const globalChanged = globalId && globalId !== profile.global_level_id;
    await studentLanguageRepository.updateWithHistory(profile.id, patch, globalChanged ? {
      old_level_id: profile.global_level_id,
      new_level_id: globalId,
      changed_by: assessedBy,
      reason: data.reason ?? 'Placement test',
      method,
      score: patch.assessment_score ?? null
    } : null);

    const updated = await this.findOne(studentId, languageId);
    return { profile: updated, skillLevels: assessed };
  }

  /**
   * Courses taught in the student's language at (or near) their level.
   * Exact matches first, then the neighbouring levels — an admin enrolling
   * outside the exact level does so knowingly (§7.4).
   */
  async compatibleCourses(studentId, languageId) {
    const profile = await this.findOne(studentId, languageId);
    const { all } = require('../utils/dbHelpers');

    const courses = await all(
      `SELECT c.*, l.code AS language_code, l.name AS language_name,
              lv.code AS level_code, lv.order_index AS level_order
       FROM courses c
       LEFT JOIN languages l ON l.id = c.language_id
       LEFT JOIN levels lv ON lv.id = c.level_id
       WHERE (c.language_id = ? OR c.language_id IS NULL)
       ORDER BY
         CASE WHEN c.level_id IS NULL THEN 2 ELSE 0 END,
         ABS(COALESCE(lv.order_index, 0) - COALESCE(?, 0)) ASC`,
      [languageId, profile.global_level_order ?? 0]
    );

    return courses.map((course) => ({
      ...course,
      level_match: profile.global_level_id && course.level_id === profile.global_level_id
        ? 'exact'
        : course.level_id ? 'near' : 'unlevelled'
    }));
  }

  /**
   * Check whether enrolling the student in a course is level-coherent.
   * Returns a verdict instead of refusing: incoherent enrolment needs an
   * admin confirmation, not a silent rule (§7.4).
   */
  async checkEnrollment(studentId, courseId) {
    const id = await StudentLanguageService.resolveStudentId(studentId);
    const course = await get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

    if (!course.language_id || !course.level_id) {
      return { coherent: true, requiresConfirmation: false, reason: 'Course has no CEFR level assigned' };
    }

    const profile = await studentLanguageRepository.findByStudentAndLanguage(id, course.language_id);
    if (!profile || !profile.global_level_id) {
      return {
        coherent: false, requiresConfirmation: true,
        reason: 'Student has no assessed level in the course language',
        courseLevelId: course.level_id
      };
    }

    const [studentLevel, courseLevel] = await Promise.all([
      levelRepository.findById(profile.global_level_id),
      levelRepository.findById(course.level_id)
    ]);
    // Both come back camelCase from BaseRepository.
    const gap = courseLevel.orderIndex - studentLevel.orderIndex;
    return {
      coherent: gap === 0,
      requiresConfirmation: gap !== 0,
      reason: gap === 0
        ? 'Student level matches the course level'
        : `Student is ${studentLevel.code}, course requires ${courseLevel.code}`,
      studentLevel: studentLevel.code,
      courseLevel: courseLevel.code
    };
  }

  /** Map a 0-100 score to a level through the active placement bands. */
  static async levelForScore(score) {
    const band = await get(
      `SELECT b.*, l.code FROM placement_bands b
       JOIN levels l ON l.id = b.level_id
       WHERE b.is_active = 1 AND ? BETWEEN b.min_score AND b.max_score
       ORDER BY b.min_score DESC LIMIT 1`,
      [score]
    );
    if (!band) {
      throw new AppError(`No placement band covers score ${score}`, 422, 'NO_BAND_FOR_SCORE');
    }
    return band.level_id;
  }

  static async listBands() {
    const { all } = require('../utils/dbHelpers');
    return await all(
      `SELECT b.*, l.code AS level_code, l.order_index AS level_order
       FROM placement_bands b JOIN levels l ON l.id = b.level_id
       ORDER BY b.min_score ASC`
    );
  }

  static async updateBand(id, data) {
    const { run } = require('../utils/dbHelpers');
    const band = await get('SELECT * FROM placement_bands WHERE id = ?', [id]);
    if (!band) throw new AppError('Placement band not found', 404, 'NOT_FOUND');

    const patch = {};
    if (data.minScore !== undefined) patch.min_score = Number(data.minScore);
    if (data.maxScore !== undefined) patch.max_score = Number(data.maxScore);
    if (data.levelCode !== undefined) {
      const level = await levelRepository.findByCode(data.levelCode);
      if (!level) throw new AppError(`Unknown level: ${data.levelCode}`, 404, 'LEVEL_NOT_FOUND');
      patch.level_id = level.id;
    }
    if (data.isActive !== undefined) patch.is_active = data.isActive ? 1 : 0;

    if (patch.min_score !== undefined || patch.max_score !== undefined) {
      const min = patch.min_score ?? band.min_score;
      const max = patch.max_score ?? band.max_score;
      if (min > max) throw new AppError('minScore cannot exceed maxScore', 400, 'INVALID_BAND');
    }

    const cols = Object.keys(patch);
    if (cols.length > 0) {
      await run(`UPDATE placement_bands SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...Object.values(patch), id]);
    }
    return await get(
      `SELECT b.*, l.code AS level_code FROM placement_bands b JOIN levels l ON l.id = b.level_id WHERE b.id = ?`,
      [id]
    );
  }

  // -- helpers -----------------------------------------------------------

  static async assertStudent(studentId) {
    const row = await get('SELECT id FROM students WHERE id = ?', [Number(studentId)]);
    if (!row) throw new AppError('Student not found', 404, 'NOT_FOUND');
  }

  /**
   * Accept either the users-table id or the students-table id.
   * The users id wins: every UI list (/students, enrolment forms) carries user
   * ids, while the students id is an internal key. A raw students id still
   * resolves when no user claims it.
   */
  static async resolveStudentId(rawId) {
    const num = Number(rawId);
    if (!Number.isInteger(num) || num <= 0) {
      throw new AppError(`Invalid student id: ${rawId}`, 400, 'INVALID_ID');
    }
    const byUser = await get('SELECT id FROM students WHERE user_id = ?', [num]);
    if (byUser) return byUser.id;
    const asTable = await get('SELECT id FROM students WHERE id = ?', [num]);
    if (asTable) return num;
    throw new AppError('Student not found', 404, 'NOT_FOUND');
  }

  static async assertLanguage(languageId) {
    const row = await get('SELECT id FROM languages WHERE id = ?', [languageId]);
    if (!row) throw new AppError('Language not found', 404, 'NOT_FOUND');
  }

  static requireId(value, name) {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
      throw new AppError(`Invalid ${name}: ${value}`, 400, 'INVALID_ID');
    }
    return num;
  }

  static assertMethod(method) {
    if (!ASSESSMENT_METHODS.includes(method)) {
      throw new AppError(
        `Invalid assessment method: ${method}. Expected one of: ${ASSESSMENT_METHODS.join(', ')}`,
        400,
        'INVALID_METHOD'
      );
    }
  }

  /**
   * Turn level codes ({global, listening, ...}) into level ids, verifying each
   * code exists. Unknown keys are ignored so partial updates pass through.
   */
  static async resolveLevelCodes(data, { allowMissing = false } = {}) {
    const ids = {};
    for (const key of ['global', 'listening', 'reading', 'speaking', 'writing']) {
      const codeKey = `${key}LevelCode`;
      const altKey = key === 'global' ? 'levelCode' : undefined;
      const code = data[codeKey] ?? (altKey ? data[altKey] : undefined) ?? data[key];
      if (code === undefined || code === null) {
        if (!allowMissing) ids[key] = undefined;
        continue;
      }
      const level = await levelRepository.findByCode(code);
      if (!level) throw new AppError(`Unknown level: ${code}`, 404, 'LEVEL_NOT_FOUND');
      // findByCode returns camelCase (BaseRepository.toCamelCase).
      if (!level.isActive) {
        throw new AppError(`Level ${code} is inactive and cannot be assigned`, 422, 'LEVEL_INACTIVE');
      }
      ids[key] = level.id;
    }
    return ids;
  }
}

module.exports = new StudentLanguageService();
module.exports.StudentLanguageService = StudentLanguageService;
module.exports.SKILL_COLUMNS = SKILL_COLUMNS;
module.exports.ASSESSMENT_METHODS = ASSESSMENT_METHODS;
