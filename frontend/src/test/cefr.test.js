import { describe, it, expect } from 'vitest'
import {
  mainLevel,
  cefrVariant,
  skillLabel,
  assessmentMethodLabel,
  formatScore,
  ASSESSED_SKILLS
} from '../utils/cefr'
import { statusVariant, pedagogyStatusLabel } from '../utils/money'

describe('mainLevel', () => {
  it('extracts A1..C2 from sub-level codes', () => {
    expect(mainLevel('A1.1')).toBe('A1')
    expect(mainLevel('B2.2')).toBe('B2')
    expect(mainLevel('C1')).toBe('C1')
  })

  it('returns null for unknown codes', () => {
    expect(mainLevel('Z9')).toBeNull()
    expect(mainLevel(null)).toBeNull()
    expect(mainLevel(undefined)).toBeNull()
  })
})

describe('cefrVariant', () => {
  it('groups A levels as success, B as info, C as primary', () => {
    expect(cefrVariant('A1.1')).toBe('success')
    expect(cefrVariant('A2.2')).toBe('success')
    expect(cefrVariant('B1.1')).toBe('info')
    expect(cefrVariant('B2.2')).toBe('info')
    expect(cefrVariant('C1.1')).toBe('primary')
    expect(cefrVariant('C2.2')).toBe('primary')
  })

  it('falls back to default for unknown codes', () => {
    expect(cefrVariant('Z9')).toBe('default')
  })
})

describe('labels', () => {
  it('names the four skills in French', () => {
    expect(skillLabel('listening')).toBe('Compréhension orale')
    expect(skillLabel('reading')).toBe('Compréhension écrite')
    expect(skillLabel('speaking')).toBe('Expression orale')
    expect(skillLabel('writing')).toBe('Expression écrite')
  })

  it('exposes the four assessed skills in order', () => {
    expect(ASSESSED_SKILLS).toEqual(['listening', 'reading', 'speaking', 'writing'])
  })

  it('names the assessment methods in French', () => {
    expect(assessmentMethodLabel('placement_test')).toBe('Test de placement')
    expect(assessmentMethodLabel('exam')).toBe('Examen')
  })

  it('formats scores as percentages', () => {
    expect(formatScore(72)).toBe('72%')
    expect(formatScore(null)).toBe('-')
    expect(formatScore(undefined)).toBe('-')
  })
})

describe('pedagogyStatusLabel', () => {
  it('translates session and course statuses to French', () => {
    expect(pedagogyStatusLabel('scheduled')).toBe('Planifiée')
    expect(pedagogyStatusLabel('completed')).toBe('Terminée')
    expect(pedagogyStatusLabel('cancelled')).toBe('Annulée')
    expect(pedagogyStatusLabel('postponed')).toBe('Reportée')
    expect(pedagogyStatusLabel('active')).toBe('Actif')
  })

  it('falls back to the raw code when unknown', () => {
    expect(pedagogyStatusLabel('weird')).toBe('weird')
    expect(pedagogyStatusLabel(null)).toBe('-')
  })
})

describe('statusVariant', () => {
  it('keeps distinct colours for pedagogy states', () => {
    expect(statusVariant('scheduled')).toBe('info')
    expect(statusVariant('completed')).toBe('success')
    expect(statusVariant('postponed')).toBe('warning')
    expect(statusVariant('active')).toBe('success')
  })
})
