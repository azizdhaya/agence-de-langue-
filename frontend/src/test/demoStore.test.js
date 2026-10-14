import { describe, it, expect } from 'vitest'
import { normalizeLanguageName, courseLanguageIsActive } from '../data/demoStore'

const demoLanguages = [
  { id: 1, name: 'Anglais', code: 'EN', isActive: true },
  { id: 2, name: 'Français', code: 'FR', isActive: true },
  { id: 3, name: 'Allemand', code: 'DE', isActive: false }
]

describe('normalizeLanguageName', () => {
  it('lowercases and trims', () => {
    expect(normalizeLanguageName('  Anglais ')).toBe('anglais')
  })

  it('strips accents so "Francais" matches "Français"', () => {
    expect(normalizeLanguageName('Francais')).toBe(normalizeLanguageName('Français'))
  })

  it('tolerates nullish values', () => {
    expect(normalizeLanguageName(null)).toBe('')
    expect(normalizeLanguageName(undefined)).toBe('')
  })
})

describe('courseLanguageIsActive', () => {
  it('matches exactly', () => {
    expect(courseLanguageIsActive(demoLanguages, 'Anglais')).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(courseLanguageIsActive(demoLanguages, 'anglais')).toBe(true)
    expect(courseLanguageIsActive(demoLanguages, 'FRANÇAIS')).toBe(true)
  })

  it('matches without accents', () => {
    expect(courseLanguageIsActive(demoLanguages, 'Francais')).toBe(true)
  })

  it('hides courses of an inactive language', () => {
    expect(courseLanguageIsActive(demoLanguages, 'Allemand')).toBe(false)
    expect(courseLanguageIsActive(demoLanguages, 'allemand')).toBe(false)
  })

  it('shows courses whose language is unknown to the demo store', () => {
    // On ne masque jamais ce qu'on ne sait pas rattacher.
    expect(courseLanguageIsActive(demoLanguages, 'Chinois')).toBe(true)
    expect(courseLanguageIsActive([], 'Anglais')).toBe(true)
  })

  it('shows courses without a language', () => {
    expect(courseLanguageIsActive(demoLanguages, null)).toBe(true)
    expect(courseLanguageIsActive(demoLanguages, undefined)).toBe(true)
    expect(courseLanguageIsActive(demoLanguages, '')).toBe(true)
  })
})
