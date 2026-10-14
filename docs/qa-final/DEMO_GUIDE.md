# DEMO_GUIDE — présentation client (Windows PowerShell)

> **Mise à jour 13/10/2026 — module financier retiré.** Les étapes Finance,
> Facturation, Encaissement, Solde, Impayés, Rapports et le catalogue de tarifs
> n'existent plus (pages, routes et tables supprimées, migration `020`). Le
> scénario ci-dessous est conservé comme archive ; ne pas présenter les étapes 1,
> 4, 5, 6 ni la relance depuis Impayés. Utiliser les modules Pédagogie,
> Communication, Certificats et Documents.

## 1. Prérequis
- Node.js 22 (`node --version`), dossiers `backend/` et `frontend/` avec `node_modules`
  (sinon `npm.cmd install` dans chaque dossier).
- Ports libres : `3000` (backend), `3001` (frontend).
- Base démo : `backend/database/language_center.db` (ne jamais la vider sans la sauvegarder :
  `Copy-Item database/language_center.db database/sauvegarde-JJ-MM-AAAA.db`).

## 2. Démarrage exact
```powershell
# Terminal 1 — backend
cd "C:\Users\Mouhamed aziz\OneDrive\Bureau\agence de langue\backend"
npm.cmd run migrate   # attendu : "Database schema up to date" (ou liste 002→020 sur base neuve)
node src/server.js    # attendu : "Server running on port 3000"
```
```powershell
# Terminal 2 — frontend
cd "C:\Users\Mouhamed aziz\OneDrive\Bureau\agence de langue\frontend"
npm.cmd run dev -- --port 3001 --host   # ouvrir http://localhost:3001
```
Si `EADDRINUSE` : un ancien processus occupe le port — `netstat -ano | Select-String ":3000 "`,
puis `Stop-Process -Id <PID> -Force`, et relancer. Ne jamais laisser deux backends.

## 3. Connexion démo vérifiée
- URL : `http://localhost:3001/login`
- Compte : `admin@center.com` (mot de passe de démonstration communiqué hors rapport).
- Vérifié le 11/10/2026 : login 200 + JWT, rôles `teacher`/`student` refusés (403)
  sur les routes d'administration, lecture de son propre profil OK.
- Après expiration de session : déconnexion/reconnexion (jeton 7 jours, sans rotation en démo).

## 4. Scénario de présentation (15 min, exécuté le 11/10/2026 : 12/12)
1. **Paramètres** : Finance → Paramètres de financement → règles, un tarif (ex. Arabe A1),
   une remise, aperçu.
2. **Candidat** : Pédagogie → Candidats → Nouveau (vérifier fiche + niveaux CECRL).
3. **Cours/Groupe** : créer si besoin, **Gérer les candidats** → ajouter (capacité appliquée).
4. **Facturation** : Factures → *Facturer une inscription* (total calculé serveur) → PDF.
5. **Encaissement** : Paiements → acompte → reçu auto → *Télécharger le reçu PDF*.
6. **Solde** : régler le reste → facture `Payée`, solde 0 → Rapports (cohérence).
7. **Pédagogie** : Présences (grille + enregistrement), Notes (ajout + moyenne).
8. **Communication** : Annonces → Publier (visible même sans expiration) ; Messages → `+`
   → envoyer (temps réel) ; Notifications (relance depuis Impayés → cloche).
9. **Contrôle** : Paramètres → Contrôle (matrice des droits + journal d'audit).
10. **Vérifications avant client** : `npm.cmd run build` OK, console navigateur (F12) sans
    rouge, pages vides = états vides (normal sur base neuve), PDF qui s'ouvrent.

## 5. Données de test
- Créer sous un préfixe reconnaissable (ex. `Démo ...`) pour les supprimer après.
- Ne jamais utiliser de données personnelles réelles.
- Base de test isolée possible : `$env:DB_PATH='<chemin>\test-demo.db'; npm.cmd run migrate`
  puis `node src/utils/seed.js`, backend avec le même `DB_PATH` sur un autre port
  (`$env:PORT=3100; node src/server.js`).

## 6. Récupération en cas de problème
- Backend tombé : relancer le Terminal 1 ; s'il refuse (`EADDRINUSE`), tuer l'occupant ( §2 ).
- Page blanche/ancienne : **Ctrl+F5** (cache du navigateur).
- Token invalide après rotation du secret : se reconnecter.
- Base corrompue : arrêter le backend, recopier la sauvegarde sur
  `database/language_center.db`, `npm.cmd run migrate`, relancer.
- Annonce invisible : vérifier son expiration (jour inclus) et son audience.
- Impayé non détecté : *(module financier retiré — étape obsolète)*.
