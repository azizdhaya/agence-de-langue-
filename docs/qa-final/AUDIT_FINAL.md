# AUDIT FINAL — CRM Centre de Langues
Date : 11/10/2026. Périmètre : `backend/src`, `frontend/src`, base SQLite, migrations 002→017.
Méthode : inspection + exécution réelle (suites, smoke live, scénario démo sur base isolée).

> **Note 13/10/2026.** Ce rapport reflète l'état **avant** le retrait du module
> financier. Depuis, les fichiers financiers et leurs tables ont été supprimés
> (migration 020). Voir `TEST_RESULTS.md` (« Retrait complet du module financier »).

## 1. Architecture examinée
- **Backend** : Express 4 + `sqlite3`, 25 routeurs (`app.js`), 26 services, 5 middlewares
  (`auth`, `rbac` fin `domain:action`, `validate` Joi + normalisation dates, `transaction`,
  `errorHandler`), `dbHelpers` (promesses), JWT 7j, Socket.io, PDFKit (factures/reçus A4).
- **Frontend** : React 18 + Vite + Tailwind, Axios (`/api` → `:3000`), React Router (26 routes),
  27 pages, composants partagés (`CrudPage`, `Modal`, `ConfirmDialog`, ui/*), `ToastContext`.
- **Données** : ~35 tables, `document_sequences` (FAC/PAY/REC uniques), `audit_logs` append-only,
  `center_settings` clé/valeur, tarifs, remises, `payment_allocations` (multi-factures),
  `receipts.details` (snapshot gelé). Pas de module devis (supprimé, migration 013).
- **Conventions** : UI = IDs `users`, métier = `students.id` → résolution user-first obligatoire ;
  calculs financiers backend uniquement ; statuts à transitions contrôlées (409) ; rôles
  `admin|teacher|student` (CHECK, aucun autre).

## 2. Modules testés
Auth/RBAC, CRUD pédagogique (candidats, profs, cours, groupes + membres, sessions,
présences, notes, langues, niveaux CECRL, certificats, documents), inscription + cohérence
CEFR, factures (manuelle/depuis inscription/remises nommées), paiements (intégral/partiel/
échelonné/multi-factures/acomptes), reçus + PDF, impayés + relances, rapports, paramètres
de financement (tarifs, remises, moyens, échéancier, audit, permissions), communication
(messages temps réel, annonces/audiences, notifications + lecture), certificats + vérif
publique, PDF factures/reçus (contenu décodé, A4, accents, pagination, logo).

## 3. Anomalies trouvées et corrigées (détail : BUGS_FIXED.md)
| # | Gravité | Anomalie |
|---|---------|----------|
| A1 | P0 | Inscription ouverte avec rôle arbitraire (dont `admin`), sans Joi |
| A2 | P0 | Hashes bcrypt exposés dans `GET /students`, `/:id`, `/teachers`, `/:id` |
| A3 | P1 | `markAsRead` marquait avant de contrôler → 403 abusif pour le propriétaire + flip d'autrui |
| A4 | P1 | Notifications lisibles par tout teacher (liste, détail, lecture) |
| A5 | P1 | Socket.io sans auth (usurpation d'identité d'envoi/écoute) |
| A6 | P1 | Message sans limite de taille, destinataire inexistant → 500 SQLITE |
| A7 | P1 | Lectures notes/présences/certificats sans résolution user-id (vide/500) |
| A8 | P2 | `ORDER BY` interpolé : non atteignable (vérifié), durci quand même |
| A9 | P2 | Lectures inscriptions/factures : filtre `studentId` sans résolution |

## 4. Causes racines
- Double espace d'IDs (`users.id` vs `students.id`) sans résolution systématique aux frontières.
- Contrôles après effets de bord (audit du marquage, pas d'existence du destinataire).
- Confiance aux données client (rôle, `order`, contenu illimité, socket).
- Réponses `SELECT u.*` sans projection.

## 5. Corrections réalisées
Verrouillage inscription (admin + Joi + whitelist), purge des hashes, allowlist `ORDER BY` +
clés `where` (`BaseRepository`), résolution user-first partout (écritures + lectures notes/
présences/certificats + filtre factures), `markAsRead` (contrôle avant effet, 404 propre),
scope notifications non-admin, validation messages + 404 destinataire, auth Socket.io des
deux côtés, rotation `JWT_SECRET`, `register`/login validés Joi.

## 6. Risques résiduels (acceptés, documentés)
- R1. Pas de rate-limit ciblé login ni verrouillage anti-bruteforce (limiteur global 1000/15min).
- R2. JWT 7j en `localStorage`, pas de rotation (`refresh_tokens` inutilisée) — OK en démo LAN.
- R3. Stack d'erreur exposée hors production (`NODE_ENV=development` par défaut).
- R4. Upload logo : contrôle par extension+MIME, pas de magic bytes (impact borné : admin seul, servi en image).
- R5. Pas de rôles commercial/comptable (CHECK `users`) — matrice en lecture seule assumée.
- R6. Concurrence SQLite : transactions sérialisées mono-processus ; pas de multi-instance.

## 7. Éléments non vérifiés
- Navigateur réel : Playwright absent (non installé pour ne pas perturber le projet) → console
  navigateur, responsive tablette/mobile, reconnexions Socket : BLOCKED, à contrôler en démo.
- Montée en charge : aucun test de charge (interdit sur base réelle, hors périmètre démo).
- Données réelles du client : base démo uniquement (vidée puis re-simulée par l'utilisateur).
