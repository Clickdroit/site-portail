# site-portail

Portail de projets Clickdroit — dashboard engineering-style avec terminal simulé, métriques en temps réel et navigation clavier complète.

---

## Architecture

```
site-portail/
├── index.html                  # Point d'entrée HTML (structure sémantique)
├── assets/
│   ├── css/
│   │   └── styles.css          # Feuille de styles globale (thèmes dark/light, layout)
│   └── js/
│       ├── main.js             # Point d'entrée JS (initialisation, raccourcis, métriques)
│       └── modules/
│           ├── theme.js        # Gestion du thème clair/sombre (localStorage)
│           ├── terminal.js     # Terminal simulé (historique, auto-complétion)
│           └── projects.js     # Chargement, rendu, recherche et filtrage des projets
├── data/
│   └── projects.json           # Source de données des projets (configuration)
└── README.md
```

Les fichiers JS utilisent la syntaxe **ES Modules** (`import`/`export`) et sont chargés avec `defer type="module"`.

---

## Données (`data/projects.json`)

Chaque projet est décrit par :

| Champ         | Type     | Description                                      |
|---------------|----------|--------------------------------------------------|
| `id`          | number   | Identifiant unique (utilisé pour `open <n>`)     |
| `name`        | string   | Nom affiché sur la carte                         |
| `type`        | string   | Type de projet (`web`, `api`, etc.)              |
| `description` | string   | Description courte                               |
| `url`         | string   | URL de destination                               |
| `tags`        | string[] | Technologies (utilisées pour les filtres)        |
| `status`      | string   | `UP` · `DEGRADED` · `DOWN`                       |
| `updatedAt`   | string   | Date de dernière mise à jour (YYYY-MM-DD)        |

**Pour ajouter un projet**, il suffit d'ajouter un objet dans `data/projects.json`. Les cartes sont générées dynamiquement — aucune modification HTML requise.

---

## Fonctionnalités

### Dashboard engineering
- **Métriques health-check** (uptime, latence, requêtes/min) rafraîchies automatiquement via `/api/health` (fallback par probe URL des projets).
- **Badges de statut** par projet : `UP` (vert), `DEGRADED` (orange), `DOWN` (rouge).
- **Journal d'événements** (event log) avec niveaux INFO / WARN / ERROR.

### Interactions avancées
- **Recherche en temps réel** sur nom, description et tags.
- **Filtres par tag/stack** générés dynamiquement depuis les données.
- **Tri** : ordre défaut, nom (A–Z), statut, date de mise à jour.
- **Raccourcis clavier** :
  - `/` — focus sur la recherche
  - `t` — bascule entre thème sombre et clair
  - `g` puis `1`–`9` — ouvrir le projet correspondant
  - `Escape` — vider et quitter la recherche

### Terminal simulé
Commandes disponibles depuis la barre latérale :

| Commande              | Effet                                       |
|-----------------------|---------------------------------------------|
| `help`                | Affiche la liste des commandes              |
| `list`                | Liste les projets avec leur statut          |
| `open <n>`            | Ouvre le projet n°n                         |
| `status`              | Affiche l'uptime réel exposé par `/api/health` |
| `theme dark|light`    | Change le thème                             |
| `clear`               | Vide l'output du terminal                   |

- **Historique** : navigation avec ↑ / ↓ (persisté dans `localStorage`).
- **Auto-complétion** : touche `Tab` pour compléter la commande en cours.

### Accessibilité
- Attributs `aria-*` sur tous les composants interactifs.
- Focus visible sur tous les éléments focusables.
- Navigation clavier complète (recherche, filtres, cartes, terminal).
- Fallback presse-papiers (`execCommand` si `navigator.clipboard` indisponible).
- Classe `.sr-only` pour les labels visuellement masqués.

---

## Thèmes

Le thème par défaut est **sombre** (style NOC/DevOps).  
Le choix est persisté dans `localStorage` sous la clé `portal-theme`.

Commutation : bouton en haut à droite, raccourci `t`, ou commande `theme dark|light`.

---

## Conventions

- **CSS** : variables CSS via `:root` / `[data-theme]`, BEM simplifié pour les classes.
- **JS** : ES Modules natifs, `async/await` pour le fetch, pas de bundler requis.
- **HTML** : sémantique (`header`, `main`, `aside`, `footer`, `section`), rôles ARIA explicites.
- **Données** : toute extension passe par `data/projects.json`, jamais par le HTML.

---

## Étendre le projet

### Ajouter un projet
1. Ouvrir `data/projects.json`.
2. Ajouter un objet avec les champs décrits dans le tableau ci-dessus.
3. C'est tout — la carte apparaît automatiquement au prochain chargement.

### Ajouter une commande terminal
1. Ouvrir `assets/js/modules/terminal.js`.
2. Ajouter le nom de la commande dans le tableau `COMMANDS`.
3. Ajouter un `case` dans la fonction `execute()`.

### Ajouter un module JS
1. Créer `assets/js/modules/monModule.js` avec les exports nécessaires.
2. L'importer dans `assets/js/main.js`.

---

## Déploiement

Fichiers statiques purs — aucun build requis.  
Servir le dossier racine avec n'importe quel serveur HTTP.

> **Note** : `data/projects.json` est chargé via `fetch()`, ce qui nécessite un serveur HTTP (pas `file://`). En local, utiliser par exemple `npx serve .` ou l'extension Live Server de VS Code.
