# Module Cours — refonte professionnelle (mission §1–§10)

> **Mise à jour 13/10/2026 — retrait du module financier.** Le **catalogue de
> tarifs** et le **lien tarif sur les cours** (migration 019, sélecteur de tarif,
> `tariff_label`) ont été retirés avec le reste du financier. Le champ `price`
> du cours reste la seule source de prix. Les mentions « tarif » ci-dessous
> décrivent l'état historique avant retrait et ne sont plus valides ; voir
> `TEST_RESULTS.md` (section « Retrait complet du module financier »). Le reste
> de la refonte (type/mode, cohérence des dates, conflits de séances, filtres,
> fiche détail) reste en place.
>
> **Mise à jour 14/10/2026 — programme du cours.** La fiche cours accueille
> désormais une section **Programme** (modules → sous-modules, prix porté par le
> sous-module, remise module en %) et l'inscription permet de cocher des modules
> (les sous-modules deviennent des échéances). Le champ `price` du cours reste
> un prix d'affichage au niveau cours ; la **feuille facturable** est le
> sous-module. Voir `FINANCE_REBUILD.md`.

## Audit (fichiers lus avant toute modification)
- `backend/src/services/CourseService.js`, `SessionService.js`
- `backend/src/repositories/CourseRepository.js`, `BaseRepository.js`
- `backend/src/validators/schemas.js` (course, session), `src/routes/courses.js|groups.js|sessions.js|enrollments.js`
- `backend/src/utils/seed.js` (cours, groupes, séances), `src/models/migrations.js`, `src/models/database.js`
- `frontend/src/pages/Courses.jsx` (lu en entier), `Groups.jsx`, `Students.jsx`

## Problèmes identifiés
1. `resolveEnrollment` ne lisait jamais `tariffs` (corrigé en A14, mission précédente).
2. Cours : aucun `course_type`/`mode`, aucune cohérence dates (fin < début acceptée),
   formateur inconnu → 500 FK brut, pas de stats, pas de filtres (recherche seule),
   pas de fiche détail, formulaire monobloc, création sans statut.
3. Séances : aucun garde de conflit (double réservation formateur/salle possible),
   heures non validées au format HH:MM.
4. Distinction cours (formation) / groupe (session organisée) : respectée — le
   planning détaillé reste dans Groupes/Séances, pas dupliqué dans Cours.

## Modifications
- **Migration 018** (`add_course_type_and_mode`) : `ALTER TABLE courses ADD COLUMN`
  `course_type`, `mode` — non destructive, lignes existantes à NULL. Appliquée en
  démo : 1 cours conservé, vérifié.
- **Migration 019** (`link_course_to_tariff`) : `ADD COLUMN courses.tariff_id` —
  **retirée** le 13/10/2026 avec le module financier (migration `020` supprime la
  colonne). La facturation résolvait en priorité le tarif lié ; cette logique
  n'existe plus.
- **Backend** : Joi `courseType`/`mode` (create+update, `status` ajouté au create) ;
  `CourseService.assertLinks` (404 TEACHER/LANGUAGE/LEVEL_NOT_FOUND) ;
  `assertDates` (422 INVALID_DATE_RANGE, create+update partiel) ;
  `SessionService.assertNoConflict` (409 SESSION_CONFLICT formateur/salle, 422
  INVALID_TIME_RANGE) + format HH:MM validé par Joi.
- **Frontend `Courses.jsx`** : stats (total/en cours/planifiés/terminés), filtres
  (recherche, langue, niveau, formateur admin, statut), état vide, cartes
  enrichies (dates, pastilles type/mode, groupes reliés), formulaire en 3 sections
  (générales/organisation/**prix**) avec contrôle dates immédiat + message
  serveur, confirmation succès, confirmation de suppression explicite, fiche
  détail (vue d'ensemble, groupes, étudiants + inscrire/désinscrire admin,
  séances). Aucune section décorative. (Le bloc tarification et le sélecteur de
  tarif ont été retirés avec le financier.)
- **Statuts conservés** (`active/inactive/completed/cancelled`, CHECK existant non
  reconstruit) : En cours / Planifié / Terminé / Annulé dans l'UI.

## Tests exécutés (résultats réels)
> Résultats de la mission cours (avant retrait financier). Après retrait financier,
> les comptes sont : backend **34 suites / 359 tests PASS**, frontend **14 fichiers /
> 128 tests PASS**, build OK — voir `TEST_RESULTS.md`.
- Backend : **741/741 (52 suites)** — dont 3 nouveaux (liaison cours-tarif,
  tarif inconnu 404, tarif lié prioritaire sur l'appariement).
- Frontend : **146/146 (16 fichiers)** — dont 1 nouveau (sélecteur tarif :
  remplit le prix, envoie l'id).
- Build Vite : OK.
- Migration 019 appliquée en démo (2 cours conservés, `tariff_id` à NULL).
  Sondes isolées : 201/422/404/400/409/201 conformes. Base démo non
  modifiée par les tests (0 écriture sonde).

## Fichiers modifiés
- `backend/src/models/migrations.js` (+018)
- `backend/src/validators/schemas.js` (course, session)
- `backend/src/services/CourseService.js` (assertLinks, assertDates)
- `backend/src/services/SessionService.js` (assertNoConflict)
- `backend/tests/integration/courses.test.js` (+4), `sessions.test.js` (+5)
- `frontend/src/pages/Courses.jsx` (stats, filtres, sections, fiche)
- `frontend/src/test/courses.test.jsx` (+3, MemoryRouter)

## Reste à faire (honnête)
- Volume horaire total / durée de séance / fréquence : non stockés (dérivables des
  séances, pas dupliqués par choix) — à spécifier si le métier les exige au
  niveau cours.
- Conflits au niveau cours (chevauchement de périodes d'un formateur) : non
  bloqués (un formateur peut mener plusieurs cours) — seuls les créneaux de
  séances sont contrôlés.
- Pagination serveur : client-side sur 200 lignes (volumes actuels faibles).
