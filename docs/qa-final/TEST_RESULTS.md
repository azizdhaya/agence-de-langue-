# TEST_RESULTS — exécutions réelles du 11/10/2026

## Commandes et résultats
| Commande (répertoire) | Résultat |
|---|---|
| `backend`: `.\node_modules\.bin\jest.cmd --forceExit` (baseline initiale) | **51 suites, 697 tests PASS, 0 FAIL** |
| `backend` final après correctifs (sécu, lectures, certificats) : même commande | **52 suites, 709 tests PASS** (incl. `security.test.js` 12 tests + régressions) |
| `frontend`: `npm.cmd test -- --run` | **16 fichiers, 140 tests PASS** (final, incl. messages/announcements) |
| `frontend`: `npm.cmd run build` | **BUILD OK** (Vite, sans erreur) |
| `backend`: `node src/utils/migrate.js` sur base isolée neuve (`DB_PATH` temp) | **16 migrations 002→017 OK**, 0 table devis, 0 violation FK, CHECK 3 rôles |
| `backend`: `node src/utils/seed.js` sur base isolée | Seed OK (comptes + référentiels + démo) |
| Serveurs : backend `:3000` + `:3100` (isolé), frontend `:3001` | UP, login 200, proxy `/api` OK |

Ni `npm test` racine ni Playwright n'existent : commandes ci-dessus = scripts `package.json`
(`test`, `test:unit`, `test:integration`, `build`, `migrate`, `seed`).

## Tests ignorés / désactivés
**Aucun** (`--verbose` ne montre ni `skip` ni `todo` ; `grep -ri "skip\|todo\|xit\|xdescribe"` dans
`backend/tests` et `frontend/src/test` : uniquement des mots neutres dans des libellés).
Instabilité connue : 2 échecs transitoires sous charge machine lors d'un run parallèle au
build (rerun isolé puis complet : vert). Les tests partagent des DB par worker ; le template
est re-seedé à chaque run (`globalSetup`).

## Intégration et E2E
- **Scénario démo 20 étapes sur base isolée `:3100`** : **12/12 PASS** d'abord à 17/19 (2 vrais
  bugs trouvés : lectures sans résolution user-id, certificat 500 FK), puis **12/12** après
  correction — montants recalculés indépendamment dans le script (facture 500, acompte tiers,
  solde 333.334, moyenne 80 %, présence 100 %, certificat + vérif publique 200).
- **Smoke live ciblés** (dev `:3000`, avec nettoyage) : inscription verrouillée, hashes absents,
  ORDER BY neutralisé, notifications par rôle, messages 2000 car./404, Socket authentifié
  (échec sans token vérifié via client `socket.io-client`), PDF `%PDF-` + XObject logo.
- **E2E navigateur (Playwright)** : **BLOCKED** — non installé, ajout refusé (300 Mo + risque
  projet). Couvert par Vitest (140) + vérifications manuelles d'interface en démo.

## Build
Vite build OK après chaque vague frontend. Aucune erreur de compilation restante.

## Bloqués et raisons
- Console navigateur / responsive / reconnexion Socket : BLOCKED (pas d'automatisation
  navigateur) → contrôle visuel en démonstration (checklist DEMO_GUIDE).
- Charge : volontairement non testée.

## Re-verification audit final (meme jour)
- Backend jest --forceExit : **52 suites, 709 tests PASS** (apres retrait express-validator).
- Frontend itest run : **16 fichiers, 140 tests PASS** ; ite build OK.
- Scenario isole :3100 rejoue : **16/16 PASS** (surpaiement refuse 400, facture soldee refusee, pas de trop-percu : regle confirmee).
- Sondes live :3000 : register 401, hashes absents, order neutralise, messages 400/404, socket avec/sans token. Zero ecriture en base demo.

## E2E navigateur (Playwright + Chromium, hors depot)
- Suite crm.spec.js (11 tests) sur base isolee neuve : **11/11 PASS en 38 s** (auth, matrice 24 routes sans 500, candidats, groupes, finance + 2 PDF + CSV, RBAC navigateur, temps reel 2 contextes, annonces + notifications, reglages + tarifs + remises, mobile 375px, zero console-error/HTTP-500).
- Correctifs issus de l'E2E : parite params/placeholders recherche x5 fichiers (+5 tests Jest), retrait min/max HTML5 silencieux (Payments).

## Module Cours (refonte pro)
- Backend **738/738 (52 suites)**, frontend **145/145 (16 fichiers)**, build OK. Migration 018 appliquee en demo (1 cours conserve). Sondes isolees : 201/422/404/400/409/201. Detail : COURSES_MODULE.md.

## Liaison cours-tarif (019)
- Backend **741/741 (52 suites)**, frontend **146/146 (16 fichiers)**, build OK. Migration 019 appliquee en demo (2 cours conserves, tariff_id NULL). Detail : COURSES_MODULE.md.

## Suppression tarif (sans migration)
- Backend **743/743 (52 suites)**, frontend **147/147 (16 fichiers)**, build OK. DELETE actif = desactivation (inchange), DELETE inactif non lie = suppression definitive, lie = 409 TARIFF_IN_USE.

## Suppression tarif uniquement (desactivation retiree)
- Backend **743/743 (52 suites)**, frontend **147/147 (16 fichiers)**, build OK. DELETE = suppression definitive (409 TARIFF_IN_USE si lie). Case Actif retiree du formulaire.

## CECRL detailler (tarifs)
- Backend **744/744 (52 suites)**, frontend **148/148 (16 fichiers)**, build OK. Liste tarif groupee par niveau (A1 complet + A1.1/A1.2...), coexistence verifiee.

## Retrait complet du module financier (13/10/2026)
Portee : Factures, Paiements, Reçus, Impayés, Rapports/Documents/Paramètres
financiers, Vue d'ensemble Finance, Remises, Moyens de paiement, **catalogue de
tarifs** et **lien tarif sur les cours**, ainsi que la gestion **multi-devises**
(`/api/currencies`). Suppression du code correspondant (backend routes/
controllers/services/repositories/validators/rbac, tests, frontend pages/
routes/menu/utils) **et des tables SQLite** avec leurs données.

- **Migrations** : `005`–`011`, `013`–`017`, `019` supprimées de l'historique ;
  nouvelle migration **`020 drop_financial_tables`** (suppression `payment_allocations`,
  `invoice_items`, `receipts`, `payments`, `invoices`, `tariffs`, `discount_rules`,
  `payment_methods`, `currencies`, `center_settings`, `document_sequences`,
  `quote_items`, `quotes`, puis `ALTER TABLE courses DROP COLUMN tariff_id`).
  `enrollments` conserve ses colonnes `price`/`discount`/`amount_paid`/`balance`
  (aucune reconstruction SQLite).
- **Migration 020 sur la base de démo** : appliquée (`Done. 1 migration(s) applied.`).
  Vérification : **0 table financière restante**, `courses.tariff_id` absente,
  `schema_migrations` intacte (25 tables au total).
- **Seed** : `npm run seed` **OK** (comptes + référentiels + démo ; plus aucune
  insertion paiement/facture/devise).
- **Smoke runtime** (base de test, `NODE_ENV=test`) :
  `GET /api/dashboard/stats` **200** (sans `total_revenue`/`pending_payments`),
  `GET /api/dashboard/recent` **200** (activités inscription/annonce uniquement),
  `GET /api/courses` **200** (plus de `tariff_label`), et
  `/api/invoices`, `/api/payments`, `/api/receipts`, `/api/finance/tariffs`,
  `/api/currencies` → **404** (routes absentes).
- **Tests backend** : `npm test` → **34 suites, 359 tests PASS, 0 FAIL**
  (18 suites financières supprimées ; exit 0 à l'écriture dans un fichier. Un
  exit 1 peut apparaître quand la sortie passe par un pipe : ce sont les logs
  SQLite async « Cannot log after tests are done », sans échec de test — juger
  sur la ligne `Tests:`).
- **Tests frontend** : `npm.cmd test -- --run --pool=forks` → **14 fichiers,
  128 tests PASS, exit 0** (2 fichiers financiers supprimés).
- **Build** : `npm.cmd run build` → **BUILD OK** (aucun chunk facture/paiement/
  reçu/finance/devise).
- **Docs** : `README.md` (fonctionnalités + endpoints), `FUNCTIONAL_CHECKLIST.md`
  (section Finance remplacée par une note de retrait), `TEST_RESULTS.md` (ce
  paragraphe). Les rapports datés antérieurs (E2E_RESULTS, BUGS_FIXED, AUDIT_FINAL,
  DEMO_GUIDE) restent des archives de l'état précédent.

> **Base de sauvegarde** : `backend/database/sauvegarde-avant-simulation.db`
> (antérieure au retrait) et une copie de la base d'avant-retrait reste
> récupérable si besoin.

## Refonte du module financier — phase 1 : catalogue et échéances (14/10/2026)

Reconstruction du financier selon le modèle métier validé : **Cours → Module
(sans prix) → Sous-module (porteur du prix)**. L'étudiant s'inscrit **par
module** ; ses sous-modules deviennent des échéances. Paiement soit **par
sous-module** (prix plein), soit **du module entier** (une échéance, remise en %
définie sur le module). Détail du modèle, des routes et des phases :
`FINANCE_REBUILD.md`.

- **Migrations** : `021 add_course_module_catalogue`, `022 add_enrollment_module_charges`,
  `023 add_session_submodule`. Appliquées en démo :
  `Done. 3 migration(s) applied.` Le message `Index creation error: no such column:
  submodule_id` au démarrage est **attendu** : l'index est tenté avant migration puis
  créé par la migration `023`.
- **Schéma** (tables neuves, snake_case) : `course_modules(course_id, name, position,
  discount_percent, status)` ; `module_submodules(module_id, name, position,
  price_millimes, status)` ; `enrollment_modules(enrollment_id, module_id,
  discount_percent, status, settled_at)` ; `enrollment_submodules(enrollment_module_id,
  submodule_id, price_millimes, discount_millimes, amount_paid_millimes,
  balance_millimes, status[unpaid|paid], due_date)` + `sessions.submodule_id`.
  Suppressions en cascade FK. **Montants stockés en millimes entiers** (1 TND = 1000).
- **Seed démo** : 6 modules, 10 sous-modules, 4 inscriptions-module, 7 échéances
  (1 réglée). Base de démo vérifiée : total **1 350 000** millimes, solde **1 230 000**
  millimes (échéance réglée = 120 000).
- **Smoke live (base de démo, base non modifiée)** : `GET /api/courses/:id/modules`
  renvoie les modules et leur total ; `GET /api/students/:id/ledger` renvoie
  `Module 1 — Fondations` avec `Sons et alphabet=paid`, `Se présenter=unpaid`
  (totaux 250 000 / payé 120 000 / solde 130 000) — exactement le seed.
- **Tests backend** : `npm test` → **36 suites, 386 tests PASS, 0 FAIL**
  (nouveaux : `money.test.js` 12, `programme.test.js` 15). Un `P1` couvre les
  helpers millimes, l'arrondi de remise, le CRUD modules/sous-modules, la garde
  `MODULE_IN_USE`/`SUBMODULE_IN_USE`, l'inscription avec modules (idempotente),
  l'override de prix par inscription, le gel du prix après édition du catalogue et
  la lecture du ledger. (Même bruit SQLite async « Cannot log after tests are done »,
  sans échec — juger sur la ligne `Tests:`.)
- **Tests frontend** : `npm.cmd test` → **16 fichiers, 134 tests PASS, exit 0**
  (nouveaux : `programme.test.jsx` 3, `money.test.js` 3).
- **Build** : `npm.cmd run build` → **BUILD OK**.
- **Frontend** : `Courses.jsx` — section **Programme** dans la fiche cours (CRUD
  modules/sous-modules inline réservé admin, total du module, badge de remise) et
  **cases à cocher des modules** dans le formulaire d'inscription ; `Students.jsx` —
  section **Situation financière** dans la fiche candidat (total dû / payé / reste,
  détail par module et sous-module, pastilles Payé / À payer). Aucune nouvelle
  route ni entrée de menu : le ledger vit dans la fiche candidat (rapports = phase 4).

## Refonte du module financier — phase 2 : paiements et allocations (14/10/2026)

On peut désormais **encaisser**. Les allocations (`payment_allocations`) sont la
seule source de vérité de ce qui est payé ; les colonnes cache de
`enrollment_submodules` sont **recalculées depuis elles dans la même
transaction**. Un sous-module se règle **en totalité** — pas de solde partiel.

- **Migrations** : `024 add_payments_and_allocations`. Appliquée en démo :
  `Done. 1 migration(s) applied.`
- **Schéma** (tables neuves, snake_case) : `payments(student_id, amount_millimes,
  method[cash|card|transfer|check|other], reference, note, paid_at, recorded_by)` ;
  `payment_allocations(payment_id, enrollment_submodule_id, amount_millimes)`.
  Cascades FK ; `student_id → students ON DELETE CASCADE`,
  `recorded_by → users ON DELETE SET NULL`.
- **Règles serveur** :
  - un sous-module se règle à son **solde complet** ;
  - un **module entier** peut être réglé avec une **remise en %** uniquement s'il
    est **vierge** (aucun sous-module déjà payé) — sinon `409 MODULE_NOT_CLEAN` ;
    un module déjà entamé reste réglable **au prix plein** (`discountPercent: 0`) ;
  - la remise est **répartie au prorata** sur les sous-modules (reliquat
    d'arrondi sur le dernier) ;
  - un **paiement peut couvrir plusieurs modules**, chacun avec son propre % :
    un seul `payments` + une allocation par sous-module ;
  - les id sont vérifiés (l'échéance doit appartenir à l'étudiant) ;
  - un même sous-module ne peut pas être réglé deux fois dans un paiement
    (`400 DUPLICATE_ITEM`) ni une échéance déjà payée (`409 ALREADY_PAID`) ;
  - **annulation** d'un paiement (`DELETE /api/payments/:id`) : supprime le
    paiement et ses allocations, **annule la remise** qu'il avait accordée et
    recalcule les échéances.
- **Seed démo** : le règlement de démonstration passe maintenant par le **vrai
  chemin de paiement** (1 paiement, 1 allocation) au lieu d'une écriture directe.
  Le seed répare aussi une échéance laissée « payée » par un ancien seed sans
  allocation. Paiement de démo : 120 000 (espèces).
- **Smoke live (base de démo)** : règlement du module `Module 1 — Grammaire
  avancée` de Pierre avec **15 %** → montant **340 000** (400 000 − 60 000),
  2 lignes d'allocation ; ledger après = remise 60 000 / payé 340 000 / solde 0 ;
  puis `DELETE` du paiement → remise 0 / payé 0 / **solde 400 000**, 0 paiement.
  Boucle complète conforme.
- **Tests backend** : `npm test` → **37 suites, 396 tests PASS, 0 FAIL**
  (nouveaux : `tests/integration/payments.test.js`, 10 tests : règlement d'un
  sous-module, refus du doublon, remise sur module vierge, refus de remise sur
  module entamé, reste au prix plein, paiement multi-modules, annulation,
  validation, auth).
- **Tests frontend** : `npm.cmd test` → **17 fichiers, 141 tests PASS, exit 0**
  (nouveaux : `payments.test.jsx` 4, `money.test.js` +3 pour `distributeDiscount`).
- **Build** : `npm.cmd run build` → **BUILD OK**.
- **Frontend** : la section **Situation financière** de la fiche candidat devient
  un guichet de paiement (admin) : cases par module (« régler le module », remise
  en % éditable, verrouillée à 0 sur un module entamé) et par sous-module, panier
  récapitulatif avec **total calculé comme le serveur**, choix du moyen de
  paiement et référence, puis **Encaisser** en un appel. Historique des paiements
  avec **annulation** via `ConfirmDialog`.

### Phases suivantes
- **Phase 3 — livrée** : `due_date` saisie à l'inscription ; blocage de la présence
  par séance lorsque le sous-module est impayé (`403 SUBMODULE_UNPAID`) ; reçu
  imprimable dans le navigateur (`/payments/:id/receipt`) avec lien « Reçu » dans
  l'historique des paiements.
- **Phase 4** : rapports (encaissements, impayés) — à spécifier avec le client (filtres/date, export CSV, rôles).
