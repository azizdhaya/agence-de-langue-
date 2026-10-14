# BUGS_FIXED — anomalies corrigées pendant l'audit

> **Note 13/10/2026.** Certains correctifs ci-dessous concernent le module
> financier, retiré depuis (fichiers et tables supprimés, migration 020). Ils sont
> conservés comme historique. Voir `TEST_RESULTS.md`.

## A1. Inscription ouverte avec rôle arbitraire (P0)
- Fichier : `backend/src/routes/auth.js`
- Cause : `POST /register` public, `role` recopié du corps, pas de Joi.
- Correction : `authenticateToken` + `authorizeRoles('admin')` + `validate(schemas.auth.register)`
  (whitelist `admin|teacher|student`) ; login validé Joi.
- Test : `tests/integration/security.test.js` (anonyme 401/403, teacher 403, rôle inconnu 400,
  doublon 400, création admin 201).

## A2. Hashes bcrypt exposés en JSON (P0)
- Fichiers : `backend/src/routes/students.js`, `teachers.js` (listes + détails).
- Cause : `SELECT u.*` renvoyé tel quel.
- Correction : `password` supprimé des réponses (4 points).
- Test : `security.test.js` (aucune clé `password` sur les 4 endpoints).

## A3. Marquage notification : effet avant contrôle + 403 abusif (P1)
- Fichiers : `NotificationController.markAsRead`, `NotificationService.markAsRead`.
- Cause : `UPDATE` puis lecture de `user_id` sur le résultat brut `{id, is_read}` → `undefined`.
- Correction : lecture complète d'abord (404 propre, import `AppError` ajouté), 403 avant effet,
  ligne complète renvoyée.
- Test : `notifications.test.js` (propriétaire 200, autrui 403 sans effet, inconnu 404).

## A4. Notifications lisibles par tout teacher (P1)
- Fichier : `NotificationController` (`index`, `show`, `markAsRead`).
- Correction : non-admin limité à ses propres notifications.
- Test : `security.test.js` (liste filtrée, détail d'autrui 403).

## A5. Socket.io sans authentification (P1)
- Fichiers : `backend/src/server.js`, `frontend/src/pages/Messages.jsx`.
- Cause : `join_room`/`send_message` sur IDs fournis par le client.
- Correction : middleware `io.use` (JWT du handshake), salon = utilisateur authentifié,
  expéditeur forcé ; client envoie le token.
- Test : smoke live (`socket.io-client`, rejet sans token vérifié) ; pas de suite automatisée
  (client non installé côté backend — documenté).

## A6. Messages : contenu illimité, destinataire 500 (P1)
- Fichiers : `routes/messages.js`, `validators/schemas.js`.
- Correction : `validate(message.create)` + `max(2000)` + existence du destinataire (404).
- Test : `security.test.js` (2001 car. → 400, inconnu → 404).

## A7. Lectures sans résolution user-id + 500 certificats (P1)
- Fichiers : `routes/grades.js` (`/student`, `/summary`), `routes/attendance.js` (`/student`),
  `services/CertificateService.js`.
- Cause : IDs `users` utilisés tels quels contre des FK `students.id`.
- Correction : `resolveStudentId` partout + 404 propres ; vérification du cours pour certificats.
- Test : suites grades/attendance/certificats + scénario démo 12/12 (moyenne 80 %, présence 100 %).

## A8. Interpolation `ORDER BY` / clés `where` (P2 durci, non atteignable)
- Fichier : `repositories/BaseRepository.js` (`sanitizeOrder`, `sanitizeWhere`).
- Constat honnête : aucun contrôleur ne fait transiter `order`/`where` depuis la requête
  (vérifié par lecture + smoke live) — durcissement central en défense en profondeur.
- Test : unitaires des sanitize + sonde live neutralisée.

## A9. Filtre factures `studentId` sans résolution (P2)
- Fichier : `InvoiceService.findAllWithDetails`.
- Correction : résolution user-first (répare aussi le lien Fiche → Factures).
- Test : `receipts-pdf.test.js` (filtre par ID utilisateur).

## A10. Recherche cassée en 500 sur 5 modules (P1)
- Fichiers : `Invoice/Certificate/Document/PaymentRepository` (liste + total),
  `ReceiptRepository` (total). Moins de `params.push` que de `LIKE ?`
  (ex. factures : 2 params pour 3 placeholders) → `SQLITE_MISMATCH` dès qu'on
  cherchait. Découvert via les logs du run E2E (la recherche invoice retournait
  une page vide).
- Cause : copier-coller des blocs de recherche sans ajuster les pushes.
- Correction : parité exacte partout (audit statique des 18 blocs : tout `ok`).
- Tests : 5 tests de recherche ajoutés (`invoices`, `payments`, `receipts`,
  `certificates`, `documents`) — aucun n'existait, d'où l'angle mort.

## A11. Blocage silencieux des montants hors bornes (P2 UX)
- Fichier : `frontend/src/pages/Payments.jsx`.
- Cause : attributs HTML5 `min`/`max` sur les parts → le navigateur bloquait
  l'envoi sans aucun message (constaté en E2E : surpaiement sans retour).
- Correction : attributs retirés ; l'erreur métier 400 du serveur s'affiche
  dans la modale (source unique de vérité conservée côté backend).

## A12. Aucun moyen de retirer une inscription (P1 — bloquait toute suppression)
- Constat : la fiche candidat affichait les cours sans bouton de retrait et
  l'API n'avait aucun endpoint de désinscription. Un cours ou un groupe avec
  effectif ne pouvait donc jamais être supprimé.
- Ajout : `DELETE /api/enrollments/:id` (`CourseService.unenroll`) — supprime
  l'inscription propre uniquement ; refuse en 409 `ENROLLMENT_INVOICED` /
  `ENROLLMENT_HAS_PAYMENTS` si de l'argent a bougé (annuler la facture d'abord).
- UI : bouton « Désinscrire » par cours dans la fiche candidat (avec confirmation),
  `GET /students/:id/courses` expose désormais `enrollment_id`.
- Tests : désinscription propre puis suppression du cours OK ; inscription
  facturée → 409 sans SQLITE.

## A13. Retrait du groupe ne désinscrivait pas du cours (P1 — demande métier)
- Constat : « Retirer » ne coupait que le lien groupe (`group_id = NULL`),
  l'effectif du cours ne bougeait pas, et supprimer un groupe exigeait de
  parcourir chaque candidat à la main.
- Changement : `removeFromGroup` supprime désormais l'inscription entière
  (cours + groupe en un geste) via le garde partagé `assertEnrolmentDeletable` ;
  `DELETE /api/groups/:id` désinscrit automatiquement ses membres propres
  avant de se supprimer — un seul clic. Refus 409 explicites, sans rien
  supprimer, si un membre est facturé/payé (noms cités) ou si des séances
  existent. L'historique financier n'est jamais effacé en silence.
- UI : messages de la modale Groupe mis à jour.
- Tests : retrait → cours décrémenté ; membre facturé → 409 ; suppression
  groupe avec membres propres → cascade OK ; groupe avec membre facturé → 409
  avec groupe intact.
- Même cascade appliquée à `DELETE /api/courses/:id` : un cours avec
  membres propres se supprime en un clic (membres désinscrits) ; refus 409
  avec noms cités si un membre est facturé/payé, ou si des groupes subsistent
  (les supprimer d'abord — eux-mêmes en un clic).

## A14. Tarif du catalogue jamais appliqué à la facture (P1)
- Constat : `resolveEnrollment` calculait le prix depuis `enrollment.price ?? course.price`
  sans jamais lire la table `tariffs` — un tarif préparé (ex. A1) ne se liait jamais.
- Correction : priorité prix inscription explicite → tarif catalogue actif
  (langue du cours + niveau CECRL principal, période de validité couvrant
  aujourd'hui) → prix catalogue du cours. Niveaux legacy (beginner…proficient)
  mappés vers leurs codes CECRL conventionnels ; sous-niveaux (A1.1) rattachés
  à leur niveau principal (A1). Aperçu + facture affichent la source du prix ;
  audit enrichi (`price_source`, `tariff_id`).
- Fautes de frappe bloquantes (ex. « Allmand ») : la langue du tarif est
  désormais une liste déroulante des langues du centre + aide sous le champ.
- Tests : 4 tests (tarif appliqué, prix inscription prioritaire, typo ignorée,
  facture émise au prix du tarif).

## A15. Filtre inscriptions sans resolution user-first (P2)
- Constat : GET /api/enrollments?studentId= comparait l'ID brut a e.student_id alors que l'UI transporte l'ID utilisateur � le selecteur restait vide sans explication quand les deux ID divergent (ex. users.id=8 pour students.id=5).
- Correction : resolution StudentLanguageService.resolveStudentId comme partout ailleurs.
- Test : filtre par ID utilisateur -> inscriptions retournees.
