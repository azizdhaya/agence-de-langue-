# 🌍 Centre de Langue - Plateforme de Gestion

Plateforme complète de gestion pour un centre de langue, incluant la gestion des candidats, professeurs, cours, communication et bien plus.

> **Note** — Le module financier (factures, paiements, reçus, impayés, rapports
> et paramètres financiers, catalogue de tarifs, gestion multi-devises) a été
> retiré du backend et du frontend (tables SQLite supprimées via la migration
> `020`) puis **reconstruit par phases** : les **phases 1 (catalogue cours →
> module → sous-module + échéances)** et **2 (paiements + allocations, remise de
> module en %, annulation)** sont livrées (migrations `021`–`024`). Les échéances
> datées, le blocage dur et le reçu imprimable arrivent en phase 3, les rapports en
> phase 4. Les **rapports (encaissements, impayés)** restent à spécifier avec le
> client. Tout le reste de la plateforme (pédagogie, communication, certificats,
> documents) reste inchangé. Détail : `docs/qa-final/FINANCE_REBUILD.md`.

## 📋 Fonctionnalités

### 👨‍🎓 Gestion des Candidats
- Inscription et profils des candidats
- Suivi des niveaux et de la progression
- Historique des cours
- Informations de contact d'urgence

### 👨‍🏫 Gestion des Professeurs
- Profils et spécialisations
- Emplois du temps et cours assignés
- Suivi des qualifications

### 📚 Gestion des Cours
- Création et gestion des cours
- Planning et salles
- Inscriptions des candidats
- Niveaux et langues
- Programme : modules et sous-modules (le sous-module porte le prix)
- Échéances par candidat : payé / à payer + encaissement (registre financier, phases 1-2)
- Paiement d'un sous-module ou d'un module entier avec remise en %, un paiement multi-modules, annulation

### 💬 Messagerie
- Communication en temps réel entre professeurs et candidats
- Historique des conversations
- Notifications de messages non lus

### 📋 Gestion des Présences
- Enregistrement des présences par cours
- Suivi des absences et retards
- Statistiques de présence

### 📝 Évaluations
- Saisie des notes
- Types d'évaluations variés (examens, quiz, participation...)
- Suivi de la progression

### 📢 Annonces
- Communication générale
- Ciblage par audience (tous, candidats, professeurs)
- Niveaux de priorité

### 📊 Tableau de bord
- Statistiques en temps réel
- Graphiques et rapports
- Activités récentes

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Backend

```bash
cd backend
npm install
npm run seed  # Créer les données de démonstration
npm run dev   # Démarrer le serveur
```

Le serveur démarre sur http://localhost:3000

### Frontend

```bash
cd frontend
npm install
npm run dev   # Démarrer l'application
```

L'application démarre sur http://localhost:3001

## 🔐 Comptes de Démonstration

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur | admin@center.com | admin123 |
| Professeur | teacher@center.com | teacher123 |
| Candidat | student@center.com | student123 |

## 🛠️ Stack Technique

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **SQLite** - Base de données
- **Socket.io** - Communication temps réel
- **JWT** - Authentification
- **bcryptjs** - Hachage des mots de passe

### Frontend
- **React 18** - Bibliothèque UI
- **Vite** - Build tool
- **Tailwind CSS** - Framework CSS
- **React Router** - Routage
- **Axios** - Client HTTP
- **Recharts** - Graphiques
- **Lucide React** - Icônes

## 📁 Structure du Projet

```
agence-de-langue/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Logique métier
│   │   ├── middleware/     # Middlewares (auth, validation)
│   │   ├── models/         # Modèles de données
│   │   ├── routes/         # Routes API
│   │   ├── utils/          # Utilitaires
│   │   └── server.js       # Point d'entrée
│   ├── database/           # Fichiers SQLite
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Composants réutilisables
│   │   ├── context/        # Context React (auth)
│   │   ├── hooks/          # Hooks personnalisés
│   │   ├── pages/          # Pages de l'application
│   │   ├── utils/          # Utilitaires
│   │   ├── App.jsx         # Composant racine
│   │   └── main.jsx        # Point d'entrée
│   ├── index.html
│   └── package.json
└── README.md
```

## 🔒 Sécurité

- Authentification JWT
- Hachage des mots de passe avec bcrypt
- Protection des routes par rôle
- Validation des données
- Protection CORS

## 📝 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur

### Candidats
- `GET /api/students` - Liste des candidats
- `GET /api/students/:id` - Détails d'un candidat
- `PUT /api/students/:id` - Mise à jour
- `DELETE /api/students/:id` - Suppression

### Professeurs
- `GET /api/teachers` - Liste des professeurs
- `GET /api/teachers/:id` - Détails d'un professeur
- `PUT /api/teachers/:id` - Mise à jour

### Cours
- `GET /api/courses` - Liste des cours
- `POST /api/courses` - Créer un cours
- `PUT /api/courses/:id` - Mise à jour
- `DELETE /api/courses/:id` - Suppression
- `POST /api/courses/:id/enroll` - Inscrire un candidat (accepte `moduleIds` et `priceOverrides`)

### 📚 Programme et échéances
- `GET /api/courses/:courseId/modules` - Programme d'un cours (modules + sous-modules)
- `POST /api/courses/:courseId/modules` - Créer un module (admin)
- `GET /api/modules/:id` - Un module et son total
- `PUT /api/modules/:id` / `DELETE /api/modules/:id` - Modifier / supprimer un module (suppression bloquée si inscrit)
- `GET /api/modules/:moduleId/submodules` - Sous-modules d'un module
- `POST /api/modules/:moduleId/submodules` - Créer un sous-module (prix requis)
- `PUT /api/submodules/:id` / `DELETE /api/submodules/:id` - Modifier / supprimer un sous-module
- `GET /api/students/:studentId/ledger` - Situation financière d'un candidat
- `GET /api/enrollments/:enrollmentId/ledger` - Situation financière d'une inscription

### 💰 Paiements (phase 2)
- `GET /api/students/:studentId/payments` - Historique des paiements (admin, prof)
- `POST /api/students/:studentId/payments` - Encaisser (admin) : sous-module au prix plein ou module entier avec remise en %, en un paiement multi-lignes
- `DELETE /api/payments/:id` - Annuler un paiement (admin) et recalculer les échéances

### Messages
- `GET /api/messages/conversations` - Liste des conversations
- `GET /api/messages/:contactId` - Messages d'une conversation
- `POST /api/messages` - Envoyer un message

### Présences
- `GET /api/attendance/course/:courseId` - Présences d'un cours
- `POST /api/attendance` - Enregistrer une présence
- `POST /api/attendance/bulk` - Enregistrement en masse

### Notes
- `GET /api/grades/student/:studentId` - Notes d'un candidat
- `GET /api/grades/course/:courseId` - Notes d'un cours
- `POST /api/grades` - Ajouter une note

### Annonces
- `GET /api/announcements` - Liste des annonces
- `POST /api/announcements` - Créer une annonce
- `DELETE /api/announcements/:id` - Supprimer

### Tableau de bord
- `GET /api/dashboard/stats` - Statistiques générales
- `GET /api/dashboard/recent` - Activités récentes

## 📄 Licence

MIT License

## 👥 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.
