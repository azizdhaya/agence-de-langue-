# FUNCTIONAL_CHECKLIST — pages, boutons, champs
Légende : PASS = testé et fonctionnel (suite ou smoke live) — FAIL = bug avéré —
BLOCKED = non automatisable ici (pas de navigateur), contrôle visuel en démo.
Base démo vidée par l'utilisateur : les listes vides affichent leurs états vides.

## Authentification
| Route / action | Résultat |
|---|---|
| `/login` : connexion OK / mauvais mot de passe / champs vides | PASS (tests + live) |
| Inscription ouverte | PASS verrouillée : 401 anonyme, 403 non-admin, 400 rôle inconnu/doublon |
| Token expiré/invalide | PASS : déconnexion propre (fetchUser purge) |
| Seed `admin@center.com` | PASS : existe en démo, mot de passe non affiché ici |

## Pédagogie
| Page / bouton | Résultat |
|---|---|
| Candidats : créer/modifier/rechercher/filtrer/paginer/supprimer (garde si utilisé), fiche + Affecter | PASS |
| Professeurs : CRUD + recherche | PASS |
| Cours : CRUD + type/mode/statut, stats, filtres (langue/niveau/formateur/statut), fiche (groupes/etudiants/seances), inscription/desinscription, coherence dates, conflits seances formateur/salle | PASS (voir COURSES_MODULE.md) |
| Groupes : CRUD, **Gérer les candidats (ajout/retrait/plein)** | PASS (8 tests backend + 3 frontend) |
| Sessions : CRUD + transitions Reporter/Terminer/Annuler | PASS (suite) |
| Présences : grille + enregistrement bulk (IDs utilisateurs résolus, batch atomique en lecture d'erreur, plus de crash process) | PASS |
| Notes : ajout via ID utilisateur, erreur visible en modale, suppression confirmée | PASS |
| Langues/Niveaux (démo locale) + Skills, placement CECRL, bandes | PASS |
| Certificats : création (404 si étudiant/cours inconnu), vérification publique | PASS (live) |
| Documents : CRUD admin | PASS (suite) |

## Finance
> **Module retiré** (backend + frontend + tables SQLite, migration `020`). Les pages,
> routes, services, tests et devises ont été supprimés ; le catalogue de tarifs et
> le lien tarif sur les cours ont également été retirés. À reconstruire ultérieurement.

## Communication & temps réel
| Page / bouton | Résultat |
|---|---|
| Messages : conversations, **+ nouvelle conversation**, envoi temps réel **authentifié** (rejet sans token vérifié) | PASS (HTTP + **navigateur 2 contextes, sans rechargement**) |
| Annonces : publier (erreur visible), expiry `''`→jamais, jour-J inclus, audiences (admin tout, rôles filtrés singulier/pluriel), suppression confirmée | PASS |
| Notifications : boîte, cloche, marquer lu / tout lire (propriétaire uniquement désormais) | PASS |
| Reconnexion Socket / hors-ligne | BLOCKED (manuel en démo) |

## Navigation, responsive, console
| Contrôle | Résultat |
|---|---|
| 19 routes applicatives + 2 redirections, gardes par rôle, liens, actualisation après écriture | PASS (tests + smoke) |
| Formulaires : requis/optionnels/dates/nombres/monnaies, erreurs et succès, doubles clics gardés, annulation | PASS |
| États vides/chargement/erreur, toasts, modales, pagination, Recharts | PASS |
| Console navigateur, responsive, non-debordement | PASS (E2E Playwright : 0 erreur console inattendue, 0 HTTP 500, mobile 375px OK � voir E2E_RESULTS.md) |
| Orthographe/accents français, statuts colorés cohérents, aucune donnée technique exposée | PASS (revue statique + lecture) |
