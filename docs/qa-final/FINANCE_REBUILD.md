# Refonte du module financier — conception et feuille de route

> Le module financier précédent (factures, paiements, reçus, tarifs, devises,
> remises, rapports) a été **entièrement retiré** le 13/10/2026 (voir
> `TEST_RESULTS.md`, section « Retrait complet du module financier »). Cette
> refonte le reconstruit **par phases**, en suivant le modèle métier validé avec
> le client. **Phase 1 (catalogue + échéances)** et **phase 2 (paiements +
> allocations)** livrées le 14/10/2026.

## Modèle métier

- **Cours → Module → Sous-module.** Le **sous-module porte le prix** ; le module
  n'a pas de prix propre (c'est la **somme** de ses sous-modules, jamais une
  seconde source de vérité).
- L'étudiant **s'inscrit par module** : les sous-modules du module deviennent des
  **échéances** (charges) dues.
- Deux façons de payer :
  1. **Par sous-module**, au **prix plein** (le prix du sous-module est réglé
     entièrement — pas de solde partiel sur un sous-module).
  2. **Le module entier** en **un paiement**, avec une **remise en %** choisie par
     l'admin (valeur par défaut portée par le module, ajustable au paiement).
- Les sous-modules sont **facturés avant de commencer** ; le paiement du module
  entier est dû avant le 1er sous-module.
- Un **prix par échéance (override)** est possible à l'inscription (prix catalogue
  par défaut).
- Les sous-modules **correspondent aux séances**.
- **Pas de frais annexes** (inscription, supports, examen).

## Décisions structurantes

| Sujet | Décision |
|---|---|
| Feuille facturable | Le **sous-module** ; le module est un agrégat. |
| Stockage des montants | **Millimes entiers** (1 TND = 1000). UI : `formatMillimes`. |
| Gel du prix | **Snapshot** du prix catalogue sur l'échéance à l'inscription ; une édition du catalogue ne modifie **jamais** une dette passée. |
| Statut d'un sous-module | **payé / impayé** (tout ou rien). |
| Remise module | **Au prorata** sur les sous-modules ; **reliquat d'arrondi sur le dernier** pour un total exact. |
| Registre d'inscription | `enrollments` reste l'inscription au **cours** ; ses colonnes `price/discount/amount_paid/balance` deviennent dormantes. |
| Règles verrouillées | (1) remise module **tout-ou-rien sur un module vierge** — si un sous-module est déjà réglé à l'unité, plus de % (le reste au prix plein) ; (2) un paiement peut couvrir **plusieurs modules, chacun avec son %** ; (3) le % vient d'un **défaut configuré** que l'admin peut accepter/ajuster ; (4) l'impayé-bloque-le-début est un **blocage dur sur la présence uniquement** (notes/certificats non concernés pour l'instant) ; (5) l'override de prix est **par sous-module**. |

## Schéma (phases 1–2)

Tables neuves, tout en `snake_case` :

- `course_modules(id, course_id, name, description, position, discount_percent, status, timestamps)`
- `module_submodules(id, module_id, name, description, position, price_millimes, status, timestamps)`
- `enrollment_modules(id, enrollment_id, module_id, discount_percent, status, settled_at, registered_at, UNIQUE(enrollment_id, module_id))`
- `enrollment_submodules(id, enrollment_module_id, submodule_id, price_millimes, discount_millimes, amount_paid_millimes, balance_millimes, status[unpaid|paid], due_date, timestamps, UNIQUE(enrollment_module_id, submodule_id))`
- `payments(id, student_id, amount_millimes, method[cash|card|transfer|check|other], reference, note, paid_at, recorded_by, timestamps)` — l'argent reçu, au niveau de l'étudiant.
- `payment_allocations(id, payment_id, enrollment_submodule_id, amount_millimes, timestamps, UNIQUE(payment_id, enrollment_submodule_id))` — **source de vérité** de ce qui est payé.
- `sessions.submodule_id` (FK `ON DELETE SET NULL`) — la séance se rattache à un sous-module.

Cascades FK : `course_modules.course_id → courses ON DELETE CASCADE` ;
`module_submodules.module_id → course_modules ON DELETE CASCADE` ;
`enrollment_modules.enrollment_id → enrollments ON DELETE CASCADE`,
`.module_id → course_modules ON DELETE CASCADE` ;
`enrollment_submodules.enrollment_module_id → enrollment_modules ON DELETE CASCADE`,
`.submodule_id → module_submodules ON DELETE CASCADE` ;
`payment_allocations.payment_id → payments ON DELETE CASCADE`,
`.enrollment_submodule_id → enrollment_submodules ON DELETE CASCADE` ;
`payments.student_id → students ON DELETE CASCADE`, `.recorded_by → users ON DELETE SET NULL`.

Migrations : `021 add_course_module_catalogue`, `022 add_enrollment_module_charges`,
`023 add_session_submodule`, `024 add_payments_and_allocations`. (L'index
`idx_sessions_submodule_id` est tenté avant migration — message `Index creation
error` attendu — puis créé par la migration 023.)

## API (phases 1–2)

Lecture : tout utilisateur authentifié. Écriture : **admin**.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/courses/:courseId/modules` | Programme du cours (modules + sous-modules + total). |
| POST | `/api/courses/:courseId/modules` | Créer un module. |
| GET | `/api/modules/:id` | Un module (cours, sous-modules, total). |
| PUT | `/api/modules/:id` | Modifier un module (nom, remise, position, statut). |
| DELETE | `/api/modules/:id` | Supprimer (409 `MODULE_IN_USE` si inscriptions). |
| GET | `/api/modules/:moduleId/submodules` | Sous-modules d'un module. |
| POST | `/api/modules/:moduleId/submodules` | Créer un sous-module (prix requis). |
| PUT | `/api/submodules/:id` | Modifier un sous-module. |
| DELETE | `/api/submodules/:id` | Supprimer (409 `SUBMODULE_IN_USE` si échéances). |
| GET | `/api/students/:studentId/ledger` | Position financière d'un étudiant (+ `payments`). |
| GET | `/api/enrollments/:enrollmentId/ledger` | Position d'une inscription. |
| GET | `/api/students/:studentId/payments` | Historique des paiements (admin, prof). |
| POST | `/api/students/:studentId/payments` | Enregistrer un paiement (**admin**). |
| DELETE | `/api/payments/:id` | Annuler un paiement (**admin**) + recalcul. |

### Enregistrer un paiement

`POST /api/students/:studentId/payments` :

```jsonc
{
  "method": "card",              // cash | card | transfer | check | other
  "reference": "VIR-001",        // optionnel
  "note": "…",                   // optionnel
  "paidAt": "2026-10-14",        // optionnel (défaut : maintenant)
  "items": [
    { "enrollmentModuleId": 11, "discountPercent": 10 },  // module entier, remise 10 %
    { "enrollmentSubmoduleId": 101 }                       // ou un sous-module au prix plein
  ]
}
```

Le serveur calcule le montant (le client ne l'impose pas), crée **un** `payments`
et une allocation par sous-module réglé, puis recalcule les colonnes cache. Le
`%` du module n'est appliqué que sur un **module vierge** (sinon
`409 MODULE_NOT_CLEAN`). Un sous-module déjà réglé → `409 ALREADY_PAID` ;
un sous-module présent deux fois → `400 DUPLICATE_ITEM` ; rien à payer →
`409 NOTHING_TO_PAY`.

Inscription avec modules : `POST /api/courses/:courseId/enroll` accepte
`moduleIds: [..]` et `priceOverrides: { [submoduleId]: montantTND }` en plus des
champs existants. Idempotent (`INSERT OR IGNORE` : réinscrire conserve le
snapshot). Réponse : `{ enrollmentId, coherence, charges: [{ moduleId, created,
charges }] }`.

### Forme du ledger

```jsonc
{
  "student": { "id": 4, "first_name": "Sophie", "last_name": "Leroy" },
  "totals": { "price_millimes": 250000, "discount_millimes": 0,
              "paid_millimes": 120000, "balance_millimes": 130000 },
  "enrollments": [{
    "enrollment_id": 2, "course_id": 7, "course_name": "Français Débutant",
    "totals": { /* idem */ },
    "modules": [{
      "enrollment_module_id": 1, "module_id": 10, "module_name": "Module 1 — Fondations",
      "discount_percent": 10, "status": "active", "paid": false, "submodule_count": 2,
      "totals": { /* idem */ },
      "submodules": [{
        "enrollment_submodule_id": 1, "submodule_id": 100, "name": "Sons et alphabet",
        "price_millimes": 120000, "discount_millimes": 0,
        "amount_paid_millimes": 120000, "balance_millimes": 0,
        "status": "paid", "due_date": null
      }]
    }],
    "payments": [{
      "id": 1, "amount_millimes": 120000, "method": "cash", "reference": null,
      "paid_at": "2026-10-14T…", "recorded_by_name": "Admin User",
      "allocations": [{ "enrollment_submodule_id": 1, "amount_millimes": 120000,
                        "module_name": "Module 1 — Fondations", "submodule_name": "Sons et alphabet" }]
    }]
  }]
}
```

`paid` d'un module n'est vrai **que si tous** ses sous-modules sont `paid`.

## Frontend (phases 1–2)

- `frontend/src/pages/Courses.jsx` — section **Programme** dans la fiche cours :
  CRUD modules/sous-modules inline (admin), total du module, badge de remise ;
  **cases à cocher des modules** dans le formulaire d'inscription.
- `frontend/src/pages/Students.jsx` — composant **`StudentLedger`** dans la fiche
  candidat : total dû / payé / reste, détail par module et sous-module
  (pastilles Payé / À payer), et un **guichet de paiement** (admin) — cases par
  module (« régler le module », remise % éditable verrouillée à 0 sur un module
  entamé) et par sous-module, panier avec **total calculé comme le serveur**,
  moyen de paiement + référence, **Encaisser** ; historique des paiements avec
  **annulation** via `ConfirmDialog` et lien « Reçu » vers une page imprimable.
- `frontend/src/pages/Attendance.jsx` — sélection d'une séance et verrouillage des lignes impayées (badge « Impayé », boutons désactivés).
- `frontend/src/pages/PaymentReceipt.jsx` — reçu imprimable (page autonome).
- `frontend/src/App.jsx` — route `/payments/:id/receipt`.
- `frontend/src/utils/money.js` — `formatMillimes`, `sumMillimes`,
  `distributeDiscount` (miroir du backend pour l'aperçu).
- Aucune nouvelle route ni entrée de menu : le registre vit dans la fiche candidat.

## Phases

- **Phase 1 — catalogue + échéances (livrée).** Modules/sous-modules, inscription
  par module, snapshot des prix, ledger dérivé.
- **Phase 2 — paiements + allocations (livrée).** Tables `payments` +
  `payment_allocations` (l'allocation pointe sur l'échéance). Règlement d'un
  sous-module au prix plein ; règlement d'un module entier avec remise répartie au
  prorata (reliquat sur le dernier) ; un paiement multi-modules (une remise par
  module) ; annulation. Les colonnes cache (`amount_paid_millimes`,
  `balance_millimes`, `status`) sont recalculées depuis les allocations dans la
  **même transaction** ; les soldes restent **dérivés**. Le seed règle la démo par
  le vrai chemin de paiement.
- **Phase 3 — livrée** : `due_date` à l'inscription ; blocage de la présence par séance si le sous-module est impayé (`403 SUBMODULE_UNPAID`) ; reçu imprimable `/payments/:id/receipt` + lien « Reçu » dans l'historique.
- **Phase 4 — rapports (encaissements, impayés) — à spécifier avec le client (filtres/date, export CSV, rôles).**

## Fichiers

### Phase 1
- `backend/src/utils/money.js` — `toMillimes`, `fromMillimes`, `sumMillimes`,
  `distributeDiscount`.
- `backend/src/models/migrations.js` (+021, 022, 023), `backend/src/models/database.js`
  (`sessions.submodule_id` + 4 tables + index).
- `backend/src/repositories/ModuleRepository.js`, `SubmoduleRepository.js`.
- `backend/src/services/ModuleService.js`, `EnrollmentFinanceService.js` ;
  `CourseService.enrollStudent` (modules + charges).
- `backend/src/controllers/ModuleController.js`, `FinanceController.js` ;
  `backend/src/routes/modules.js`, `finance.js` (montées dans `app.js`).
- `backend/src/validators/schemas.js` (`module`, `submodule`, `course.enroll`,
  `session.submoduleId`).
- `backend/src/services/SessionService.js` (`assertLinks` sous-module),
  `backend/src/repositories/SessionRepository.js` (jointure du nom de sous-module).
- `backend/src/utils/seed.js` (programme + échéances de démo).
- `backend/tests/unit/money.test.js`, `backend/tests/integration/programme.test.js`.
- `frontend/src/pages/Courses.jsx`, `Students.jsx`, `frontend/src/utils/money.js`,
  `frontend/src/test/programme.test.jsx`, `frontend/src/test/money.test.js`.

### Phase 2
- `backend/src/models/migrations.js` (+024), `backend/src/models/database.js`
  (`payments` + `payment_allocations` + index).
- `backend/src/services/PaymentService.js` — enregistrement, règlement de module
  (remise distribuée), rafraîchissement des caches, historique, annulation.
- `backend/src/controllers/FinanceController.js` (ledger + paiements),
  `backend/src/routes/finance.js`, `backend/src/validators/schemas.js` (`payment.create`).
- `backend/src/utils/seed.js` (règlement de démo par le vrai chemin).
- `backend/tests/integration/payments.test.js`.
- `frontend/src/pages/Students.jsx` (`StudentLedger`), `frontend/src/utils/money.js`
  (`sumMillimes`, `distributeDiscount`), `frontend/src/test/payments.test.jsx`.

## Résultats (14/10/2026)

- Backend : **38 suites, 403 tests PASS** ; frontend : **19 fichiers, 147 tests PASS** ; build Vite OK. Migrations 021–024 appliquées en démo, seed OK.
- Smoke live phase 1 : Sophie, « Module 1 — Fondations » (payé 120 000 / solde 130 000).
- Smoke live phase 2 : règlement de « Module 1 — Grammaire avancée » (Pierre) à **15 %** → 340 000 encaissés (400 000 − 60 000), puis **annulation** → solde restauré à 400 000, remise remise à 0.
- Smoke live phase 3 : séance liée à un sous-module impayé → roster `unpaid` ; `POST /api/attendance` avec `sessionId` → `403 SUBMODULE_UNPAID` ; règlement → présence acceptée `201` ; `GET /api/payments/:id` renvoie les allocations et l'enregistreur.
