import { useState } from 'react'
import { initialLanguages, initialLevels } from './demoAdministration'

/**
 * Persistance locale de la démo Administration (Langues & Niveaux).
 *
 * Toujours SANS backend : l'état survit au refresh via `localStorage`, et les
 * deux pages partagent le même objet — activer une langue page Langues rend
 * aussitôt ses niveaux visibles page Niveaux.
 *
 * Pour brancher le vrai backend plus tard : remplacer `readStore`/`writeStore`
 * par les appels API et garder la même forme `{ languages, levels }`.
 */

const STORAGE_KEY = 'demo.administration.v1'

function freshStore() {
  // Copies profondes : les pages mutent leur tranche via setState.
  return {
    languages: initialLanguages.map((l) => ({ ...l })),
    levels: initialLevels.map((l) => ({ ...l }))
  }
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshStore()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.languages) || !Array.isArray(parsed.levels)) {
      return freshStore()
    }
    return parsed
  } catch {
    return freshStore()
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Stockage indisponible (navigation privée…) : la démo reste utilisable
    // en mémoire pour la session.
  }
}

/** Réinitialise la démo (utile avant une présentation). */
export function resetDemoStore() {
  const fresh = freshStore()
  writeStore(fresh)
  return fresh
}

/** Normalise un nom de langue pour comparaison (casse + accents). */
export function normalizeLanguageName(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Un cours (texte libre côté backend : "Français", "Anglais"…) est-il rattaché
 * à une langue ACTIVE de la démo ?
 *
 * - Correspondance par nom normalisé (insensible casse/accents).
 * - Langue inconnue du référentiel démo → visible (on ne masque jamais ce
 *   qu'on ne sait pas rattacher).
 */
export function courseLanguageIsActive(languages, courseLanguage) {
  if (!courseLanguage) return true
  const wanted = normalizeLanguageName(courseLanguage)
  const match = (languages || []).find((l) => normalizeLanguageName(l.name) === wanted)
  if (!match) return true
  return Boolean(match.isActive)
}

/**
 * État partagé `{ languages, levels }`, persisté à chaque modification.
 * Chaque page se remonte à la navigation et relit le store : les deux pages
 * restent donc cohérentes sans backend.
 */
export function useDemoStore() {
  const [store, setStore] = useState(readStore)

  const updateStore = (updater) => {
    setStore((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      writeStore(next)
      return next
    })
  }

  const setLanguages = (updater) =>
    updateStore((prev) => ({
      ...prev,
      languages: typeof updater === 'function' ? updater(prev.languages) : updater
    }))

  const setLevels = (updater) =>
    updateStore((prev) => ({
      ...prev,
      levels: typeof updater === 'function' ? updater(prev.levels) : updater
    }))

  return { languages: store.languages, levels: store.levels, setLanguages, setLevels }
}
