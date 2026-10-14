/**
 * Données de démonstration — module Administration (Langues & Niveaux).
 *
 * UNIQUEMENT pour la démo : les pages lisent et modifient ces tableaux en
 * mémoire, sans appel réseau.
 *
 * Pour brancher le vrai backend plus tard, remplacer le contenu de ce fichier :
 * chaque objet reprend exactement la forme des réponses API
 * (`GET /languages`, `GET /levels`), et chaque page expose déjà les points
 * d'entrée `fetchData / onCreate / onUpdate / onDelete` où brancher les appels.
 *
 * Relation : un niveau appartient à UNE langue (`languageId`).
 * Exemple : Anglais → A1 → A2 → B1 → B2 → C1 → C2.
 */

export const initialLanguages = [
  { id: 1, name: 'Anglais', code: 'EN', flag: '🇬🇧', description: 'Anglais général et professionnel', isActive: true },
  { id: 2, name: 'Français', code: 'FR', flag: '🇫🇷', description: 'Français général (FLE)', isActive: true },
  { id: 3, name: 'Allemand', code: 'DE', flag: '🇩🇪', description: 'Allemand général', isActive: true },
  { id: 4, name: 'Italien', code: 'IT', flag: '🇮🇹', description: 'Italien général', isActive: false },
  { id: 5, name: 'Espagnol', code: 'ES', flag: '🇪🇸', description: 'Espagnol général', isActive: true }
]

const levelNames = {
  A1: 'Débutant',
  A2: 'Élémentaire',
  B1: 'Intermédiaire',
  B2: 'Intermédiaire avancé',
  C1: 'Avancé',
  C2: 'Maîtrise'
}

const levelCodes = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

let nextLevelId = 1

function buildLevels(languageId) {
  return levelCodes.map((code, index) => ({
    id: nextLevelId++,
    code,
    languageId,
    name: levelNames[code],
    description: levelNames[code],
    order: index + 1,
    isActive: true
  }))
}

export const initialLevels = [
  ...buildLevels(1), // Anglais
  ...buildLevels(2), // Français
  ...buildLevels(3), // Allemand
  ...buildLevels(5) // Espagnol
]

/** Nombre de niveaux rattachés à une langue (affiché dans la table). */
export function countLevelsForLanguage(levels, languageId) {
  return levels.filter((level) => level.languageId === languageId).length
}
