const AppError = require('../errors/AppError');

/**
 * Permissions are `domain:action`.
 *
 * The permission vocabulary keeps reads and writes apart so a role can be
 * granted a narrow slice without rewriting every route.
 */
const rolePermissions = {
  admin: ['*'], // All permissions
  teacher: [
    'students:read', 'students:update',
    'courses:read',
    'attendance:read', 'attendance:create', 'attendance:update',
    'grades:read', 'grades:create', 'grades:update', 'grades:delete',
    'messages:read', 'messages:create',
    'announcements:read'
  ],
  student: [
    'students:read:self',
    'courses:read',
    'attendance:read:self',
    'grades:read:self',
    'messages:read', 'messages:create',
    'announcements:read'
  ]
};

/**
 * The full permission vocabulary.
 *
 * Declared separately from the role grants on purpose: `permissionsFor('admin')`
 * expands the '*' wildcard against this list, so a permission that no built-in
 * role holds yet still shows up in the answer. Deriving the expansion from the
 * union of the other roles would hide exactly the permissions that are declared
 * but not granted.
 */
const ALL_PERMISSIONS = Object.freeze([
  'students:read', 'students:update', 'students:read:self',
  'teachers:read', 'teachers:update',
  'courses:read', 'courses:write',
  'attendance:read', 'attendance:create', 'attendance:update', 'attendance:read:self',
  'grades:read', 'grades:create', 'grades:update', 'grades:delete', 'grades:read:self',
  'messages:read', 'messages:create',
  'announcements:read', 'announcements:write',
  'documents:read', 'documents:write',
  'certificates:read', 'certificates:write'
]);

// Check if a role has a specific permission
function hasPermission(role, permission) {
  const permissions = rolePermissions[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

/**
 * Every permission a role holds, with '*' expanded against ALL_PERMISSIONS.
 * @param {string} role
 * @returns {string[]}
 */
function permissionsFor(role) {
  const permissions = rolePermissions[role];
  if (!permissions) return [];
  if (!permissions.includes('*')) return [...permissions];
  return [...ALL_PERMISSIONS];
}

// Middleware to check permissions
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!hasPermission(req.user.role, permission)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }

    next();
  };
}

// Middleware to check if user can access a specific resource
function requireOwnershipOrRole(resourceType) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Teachers can access their own resources
    if (req.user.role === 'teacher') {
      // Additional checks can be added here
      return next();
    }

    // Students can only access their own resources
    if (req.user.role === 'student') {
      const resourceId = parseInt(req.params.id);
      if (resourceId !== req.user.id) {
        return next(new AppError('Access denied', 403, 'FORBIDDEN'));
      }
    }

    next();
  };
}

module.exports = {
  ALL_PERMISSIONS,
  hasPermission,
  requirePermission,
  requireOwnershipOrRole,
  permissionsFor,
  rolePermissions
};
