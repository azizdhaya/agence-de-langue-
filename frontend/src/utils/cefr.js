/**
 * CEFR helpers.
 *
 * The level code is the display value everywhere (A1.1, B1.2, ...). Colours are
 * assigned per main level so all of A1.1/A1.2 read as one family.
 */

/** Main level (A1..C2) of a code like "B1.2". Returns null for unknown codes. */
export function mainLevel(code) {
  if (typeof code !== 'string') return null
  const match = code.match(/^(A1|A2|B1|B2|C1|C2)/)
  return match ? match[1] : null
}

/**
 * Badge variant for a CEFR code.
 * Beginner (A) green, independent (B) blue, proficient (C) purple.
 */
export function cefrVariant(code) {
  const main = mainLevel(code)
  if (main === 'A1' || main === 'A2') return 'success'
  if (main === 'B1' || main === 'B2') return 'info'
  if (main === 'C1' || main === 'C2') return 'primary'
  return 'default'
}

/** French label for a profile skill key. */
export function skillLabel(skill) {
  const labels = {
    listening: 'Compréhension orale',
    reading: 'Compréhension écrite',
    speaking: 'Expression orale',
    writing: 'Expression écrite'
  }
  return labels[skill] || skill
}

/** French label for an assessment method. */
export function assessmentMethodLabel(method) {
  const labels = {
    placement_test: 'Test de placement',
    teacher_assessment: 'Évaluation enseignant',
    exam: 'Examen',
    certificate: 'Certificat',
    self_assessment: 'Auto-évaluation',
    admin_adjustment: 'Ajustement admin'
  }
  return labels[method] || method || '-'
}

/** The four assessed skills, in display order. */
export const ASSESSED_SKILLS = ['listening', 'reading', 'speaking', 'writing']

/** Main CEFR levels in order, with their French names. */
export const CEFR_MAIN_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const CEFR_NAMES = {
  A1: 'Débutant',
  A2: 'Élémentaire',
  B1: 'Intermédiaire',
  B2: 'Intermédiaire avancé',
  C1: 'Avancé',
  C2: 'Maîtrise'
}

/**
 * Display label for any CEFR code: "B1 — Intermédiaire".
 * Sub-levels reuse their parent name.
 */
export function levelDisplay(code) {
  if (!code) return '-'
  const main = mainLevel(code)
  if (!main) return code
  return `${main} — ${CEFR_NAMES[main]}`
}

/**
 * Format a 0-100 score the way the profile shows it.
 * @param {number|null|undefined} score
 */
export function formatScore(score) {
  if (score === null || score === undefined || score === '') return '-'
  return `${Number(score)}%`
}
