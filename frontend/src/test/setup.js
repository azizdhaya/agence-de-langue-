/**
 * Vitest setup file.
 * Registers jest-dom matchers and provides shared test helpers.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// React Testing Library cleanup between tests
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock matchMedia (used by some UI libraries)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
})

// Mock scrollTo (used by Messages page)
window.scrollTo = vi.fn()

// Mock scrollIntoView (used by the Messages auto-scroll effect).
// jsdom does not implement it, and the real call would throw TypeError,
// breaking the component tree in tests.
Element.prototype.scrollIntoView = vi.fn()

// Reset localStorage between tests
afterEach(() => {
  localStorage.clear()
})