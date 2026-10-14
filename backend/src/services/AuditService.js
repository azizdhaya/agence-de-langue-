const { get, all, run } = require('../utils/dbHelpers');

/**
 * AuditService
 *
 * Writes the audit_logs table. Before this service existed the table was created
 * and seeded but never written to by the application, so every sensitive action
 * went unrecorded.
 *
 * What is worth recording:
 *   - anything that moves money (payment recorded, payment refunded)
 *   - anything that changes a document's state (invoice issued, payment refunded)
 *   - anything that changes an amount (invoice edited)
 *
 * What is not: plain reads. Logging every GET would bury the entries that matter
 * and slow the list endpoints down for no audit value.
 *
 * Auditing never throws into the caller. A financial operation that succeeded
 * must not be reported as failed because the audit insert hit a problem, so a
 * failure here is logged to stderr and swallowed.
 */
class AuditService {
  /**
   * Record one action.
   *
   * @param {object} entry
   * @param {number|null} [entry.userId] who performed it
   * @param {string} entry.action e.g. 'payment.create', 'invoice.cancel'
   * @param {string} entry.resource table the action touched, e.g. 'courses'
   * @param {number|null} [entry.resourceId] row id
   * @param {object} [entry.oldValue] previous state, stored as JSON
   * @param {object} [entry.newValue] new state, stored as JSON
   * @param {string} [entry.ipAddress]
   * @param {string} [entry.userAgent]
   * @returns {Promise<number|null>} the log id, or null when it could not be written
   */
  static async log(entry) {
    try {
      if (!entry || !entry.action || !entry.resource) {
        throw new Error('AuditService.log requires an action and a resource');
      }

      const result = await run(
        `INSERT INTO audit_logs
           (user_id, action, resource, resource_id, old_value, new_value, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.userId ?? null,
          entry.action,
          entry.resource,
          entry.resourceId ?? null,
          AuditService.serialise(entry.oldValue),
          AuditService.serialise(entry.newValue),
          entry.ipAddress ?? null,
          entry.userAgent ?? null
        ]
      );

      return result.lastID;
    } catch (error) {
      // Swallowed on purpose: see the class comment.
      console.error('Audit log write failed:', error.message);
      return null;
    }
  }

  /**
   * Record an action for an authenticated request.
   * @param {object} req Express request
   * @param {object} entry as log(), without the user/IP fields
   */
  static async logFromRequest(req, entry) {
    const user = req && req.user ? req.user : {};
    return await AuditService.log({
      ...entry,
      userId: user.id ?? null,
      ipAddress: req && req.ip ? req.ip : null,
      userAgent: req && req.headers ? req.headers['user-agent'] || null : null
    });
  }

  /**
   * Read the trail for one document.
   * @param {string} resource
   * @param {number} resourceId
   * @returns {Promise<Array<object>>} newest first
   */
  static async historyFor(resource, resourceId) {
    return await all(
      `SELECT a.*, u.email as user_email, u.first_name || ' ' || u.last_name as user_name
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.resource = ? AND a.resource_id = ?
       ORDER BY a.created_at DESC, a.id DESC`,
      [resource, resourceId]
    );
  }

  /**
   * Read the trail for one user.
   * @param {number} userId
   * @param {{ limit?: number }} [options]
   */
  static async historyForUser(userId, options = {}) {
    const limit = options.limit || 100;
    return await all(
      `SELECT * FROM audit_logs
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  /**
   * Most recent entries across the system.
   * @param {{ limit?: number }} [options]
   */
  static async recent(options = {}) {
    const limit = options.limit || 100;
    return await all(
      `SELECT a.*, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Count entries per action, for a dashboard or a health check.
   * @returns {Promise<Array<{action: string, count: number}>>}
   */
  static async summary() {
    return await all(
      `SELECT action, COUNT(*) as count
       FROM audit_logs
       GROUP BY action
       ORDER BY count DESC, action ASC`
    );
  }

  /**
   * Filtered trail for the control tab: optional resource and action prefix,
   * newest first, capped. Additive: recent() is untouched.
   * @param {{ resource?: string, action?: string, limit?: number }} [options]
   */
  static async search(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 200);
    const conditions = [];
    const params = [];
    if (options.resource) {
      params.push(options.resource);
      conditions.push('a.resource = ?');
    }
    if (options.action) {
      params.push(`${options.action}%`);
      conditions.push('a.action LIKE ?');
    }
    params.push(limit);
    return await all(
      `SELECT a.*, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ?`,
      params
    );
  }

  /**
   * JSON-encode a value for the log columns.
   *
   * Returns null for an absent value so the column stays meaningful, and never
   * throws: a circular structure or a BigInt would otherwise lose the whole
   * entry.
   */
  static serialise(value) {
    if (value === undefined || value === null) return null;
    try {
      return JSON.stringify(value, (key, val) => {
        if (typeof val === 'bigint') return val.toString();
        return val;
      });
    } catch (error) {
      return JSON.stringify({ unserialisable: true });
    }
  }

  /**
   * Parse a stored JSON column back into an object.
   * @param {string|null} value
   * @returns {object|null}
   */
  static deserialise(value) {
    if (value === undefined || value === null) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove the entries of one document. Used by tests and by a retention policy;
   * never called by a route.
   * @param {string} resource
   * @param {number} resourceId
   */
  static async purge(resource, resourceId) {
    const result = await run(
      'DELETE FROM audit_logs WHERE resource = ? AND resource_id = ?',
      [resource, resourceId]
    );
    return result.changes;
  }

  /**
   * Total number of recorded entries.
   * @returns {Promise<number>}
   */
  static async count() {
    const row = await get('SELECT COUNT(*) as c FROM audit_logs');
    return row ? row.c : 0;
  }
}

module.exports = AuditService;