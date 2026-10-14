# E2E_RESULTS — navigateur réel (Playwright + Chromium, hors dépôt)

> **Archive 11/10/2026.** Le module financier a depuis été retiré (13/10/2026) :
> les étapes Finance/Facture/Paiement/Reçu/Impayé/Paramètres financiers de cette
> suite ne sont plus exécutables. Voir `TEST_RESULTS.md` (« Retrait complet du
> module financier »).

## Environnement
- Playwright `@playwright/test` + Chromium 156 installés dans
  `AppData/Local/Temp/opencode/e2e` (AUCUNE dépendance ajoutée au projet, aucun
  fichier modifié : `playwright.config.js` + `crm.spec.js` vivent hors dépôt).
- Backend `:3000` sur base **isolée neuve** (migrate 002→017 + seed), frontend `:3001`
  (proxy `/api` → `:3000`), base démo réelle **jamais touchée** (vérifié : 0 ligne sonde).
- Isolation par exécution unique (`UID = Date.now().toString(36)`) ; serveurs redémarrés
  avant le run final (compteur du rate-limiter remis à zéro).

## Résultat final : 11/11 PASS (38 s)
| # | Parcours | Preuve |
|---|---|---|
| 1 | Auth : refus invalide (message FR),anding admin → dashboard | PASS |
| 2 | Matrice navigation : 24 routes admin, contenu > 50 car., **zéro HTTP 500** | PASS |
| 3 | Candidats : création (Langue+Niveau requis), recherche filtrante, fiche, suppression | PASS |
| 4 | Groupes : ajout + retrait via modale + dialogue, capacité affichée | PASS |
| 5 | Finance : facture 600 → acompte UI 200 → **confirmation + reçu PDF téléchargé** (`Recu-REC-*.pdf`, magic `%PDF-`) → solde 400 cohérent → surpaiement **refusé avec message visible** → double-clic = 1 seul paiement → solde final payée → **facture PDF téléchargée** (`Facture-FAC-*.pdf`) → export **CSV** non vide | PASS |
| 6 | RBAC navigateur : teacher/student sans menu Finance, `/invoices` et `/payments` redirigés `/dashboard` | PASS |
| 7 | Messages temps réel : 2 contextes (admin + candidat), envoi → réception **sans rechargement** (Socket authentifié) | PASS |
| 8 | Annonces : publication visible, audience, notification reçue + marquée lue | PASS |
| 9 | Paramètres : acompte persisté après reload, tarif créé, **doublon refusé avec message**, remise simulée (net affiché) | PASS |
| 10 | Mobile 375px : dashboard/factures/candidats, `scrollWidth - clientWidth ≤ 1` | PASS |
| 11 | Méta : **zéro `console.error` inattendue, zéro HTTP 500** sur tout le run | PASS |

## Incidents de parcours (tous élucidés, aucun masqué)
- **Course UI/API** : la spec initiale appelait `:3100` pendant que l'UI passait par le
  proxy `:3000` → base unifiée sur `:3000` isolé (correctif de la suite, pas de l'app).
- **429 en rafale** : le limiteur global (1000/15 min/IP) sature après plusieurs runs accumulés ;
  contourné par redémarrage (compteur en mémoire). Comportement production **conservé**.
  Leçon consignée : un run E2E = un backend fraîchement démarré.
- **Sélecteurs ambigus** (`Nom` ⊂ `Prénom`, boutons dupliqués) : resserrés (`exact`, `.first()`).
- **Surpaiement sans message** : causé par l'attribut HTML5 `max` qui bloquait l'envoi en
  silence → **retiré (correctif app A11)**, l'erreur serveur 400 s'affiche désormais.
- **Recherche factures 500** en plein run → **bug applicatif A10 trouvé et corrigé** (voir BUGS_FIXED).

## Non couvert par le navigateur
- Impression papier (`window.print`) : dialogue natif non pilotable en headless — constaté
  présent dans le DOM, déclenchement manuel en démo.
- Reconnexion Socket après coupure réseau simulée : manuelle en démo.
- Tablette physique : viewport 375px OK, autres formats au jugé en démo.
