/**
 * Shared test helpers.
 * Provides an API mock and render utilities with providers.
 */
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import api from '../utils/api'

/**
 * Create a mocked api object with jest/vi mock functions.
 * Pass overrides to replace specific methods.
 */
export function createApiMock(overrides = {}) {
  return {
    get: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    ...overrides
  }
}

/**
 * Mock the shared api module with the given implementation.
 */
export function mockApi(overrides = {}) {
  const mock = createApiMock(overrides)
  vi.mock('../utils/api', () => ({ default: mock }))
  return mock
}

/**
 * Render a component wrapped in the providers the app relies on.
 *
 * @param {import('@testing-library/react').ReactElement} ui
 * @param {object} options
 * @param {object} [options.route] initial history entry, e.g. '/courses'
 * @param {object} [options.user] user exposed by AuthContext
 */
export function renderWithProviders(ui, { route = '/', user = null } = {}) {
  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        {children}
      </MemoryRouter>
    )
  }

  return render(ui, { wrapper: Wrapper })
}

/** A minimal admin user object for tests that need auth context. */
export const adminUser = {
  id: 1,
  email: 'admin@center.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin'
}

/** A minimal student user object. */
export const studentUser = {
  id: 4,
  email: 'student@center.com',
  firstName: 'Pierre',
  lastName: 'Bernard',
  role: 'student'
}

export { api }