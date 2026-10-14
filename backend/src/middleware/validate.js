const AppError = require('../errors/AppError');

/**
 * Turn empty strings into "not provided" before validation.
 *
 * Every form in the frontend sends '' for an untouched optional field, which a
 * strict Joi schema (e.g. `Joi.number()`) rejects — even though the field is
 * optional. Mapping '' to undefined lets "required" still fail correctly while
 * optional fields fall back to their defaults. Applies recursively to nested
 * objects and arrays (invoice/payment lines).
 */
function stripEmptyStrings(value) {
  if (value === '') return undefined;
  if (Array.isArray(value)) return value.map(stripEmptyStrings);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = stripEmptyStrings(item);
    }
    return out;
  }
  return value;
}

/**
 * Serialise Date objects left by Joi.date() back to 'YYYY-MM-DD' strings.
 *
 * Without this, a Date reaches node-sqlite3, which binds it as
 * "[object Object]": the row stores garbage and every date comparison on it
 * (e.g. the overdue sweep's `due_date < today`) silently misses. All
 * Joi.date() fields in the schemas are calendar dates, never timestamps, so
 * the date part is the whole value.
 */
function normaliseDates(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return value;
    return value.toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) return value.map(normaliseDates);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = normaliseDates(item);
    }
    return out;
  }
  return value;
}

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(stripEmptyStrings(req.body), {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const messages = error.details.map(detail => detail.message).join(', ');
      throw new AppError(messages, 400, 'VALIDATION_ERROR');
    }

    req.body = normaliseDates(value);
    next();
  };
};

module.exports = validate;
module.exports.stripEmptyStrings = stripEmptyStrings;
module.exports.normaliseDates = normaliseDates;
