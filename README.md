# Photo Pro

Site statique (Cloudflare Pages) qui transforme une photo en portrait professionnel
via l'API Images d'OpenAI, en réappliquant uniquement le *style* photographique
d'une référence (STP — Style Transfer Profile) sans jamais modifier l'identité
du sujet.

## Architecture

```mermaid
flowchart TB
    FE["Cloudflare Pages (statique)\nindex.html, app.js, styles.config.js\n/stp/*.stp.json — /assets/styles/*"]
    BK["Cloudflare Worker (proxy)\ngarde OPENAI_API_KEY en secret\n(jamais côté navigateur)\nconstruit le prompt = Prompt2.md + STP choisi"]
    API["OpenAI Images API"]

    FE -->|"photo + stp (POST)"| BK
    BK -->|"image + prompt (edits)"| API
    API -->|"image générée"| BK
    BK -->|"retour jusqu'au navigateur\n(affichée + téléchargeable)"| FE
```

La clé API OpenAI n'existe jamais côté navigateur : elle est stockée comme
secret sur le Worker Cloudflare, qui sert de proxy entre le site public et
l'API OpenAI.

## Diagrammes UML

> Le site n'a pas de compte utilisateur ni de base de données : ces éléments
> apparaissent ci-dessous pour respecter le vocabulaire UML classique, avec
> une note quand ils ne s'appliquent pas tels quels au projet.

### Diagramme de cas d'utilisation

```mermaid
flowchart LR
    Utilisateur([Utilisateur])
    Administrateur([Administrateur])
    OpenAI["API OpenAI\n(système externe)"]

    UC1((Génération du portrait))
    UC2((Téléchargement))
    UC3((Gestion des erreurs))
    UC4((Authentification\ndu Worker* ))

    Utilisateur --> UC1
    Utilisateur --> UC2
    Utilisateur --> UC3
    Administrateur --> UC4
    Administrateur -.déploie / configure.-> OpenAI
    UC1 -.appelle.-> OpenAI
    UC4 -.sécurise l'appel.-> OpenAI
```

\* Pas de login utilisateur : "Authentification" désigne la clé
`OPENAI_API_KEY` stockée comme secret Cloudflare Worker, configurée par
l'administrateur lors du déploiement.

### Diagramme de séquence

```mermaid
sequenceDiagram
    actor U as Navigateur
    participant B as Backend (Cloudflare Worker)
    participant O as API OpenAI
    participant S as Stockage éventuel*

    U->>B: POST photo + STP choisi
    activate B
    B->>B: construit le prompt (Prompt2.md + STP)
    B->>O: POST /v1/images/edits (image, prompt)
    activate O
    alt succès
        O-->>B: image générée (b64)
        B-->>S: (non utilisé aujourd'hui)
        B-->>U: image PNG (réponse au navigateur)
    else erreur OpenAI ou requête invalide
        O-->>B: erreur (status, message)
        B-->>U: JSON { error } + code HTTP
    end
    deactivate O
    deactivate B
```

\* Aucun stockage n'est implémenté actuellement : les images transitent
uniquement le temps de la requête (voir [Notes](#notes)). La ligne apparaît
en pointillés pour montrer où un stockage (ex. R2, S3) pourrait s'insérer.

### Diagramme de composants

```mermaid
flowchart TB
    subgraph Client
        FE["Frontend statique\n(HTML/JS/CSS — index.html, app.js)\nvolontairement simple : pas de\nframework React/Vite"]
    end

    subgraph Hebergement["Hébergement — Cloudflare"]
        GHP["Cloudflare Pages\n(sert le Frontend)"]
        CFW["Cloudflare Workers\n(exécute le Backend)"]
    end

    subgraph Backend["Backend (proxy)"]
        BK["worker/src/index.js"]
        AUTH["Authentification\nOPENAI_API_KEY (secret Worker)\n+ CORS via ALLOWED_ORIGIN"]
    end

    DB[("Base de données\n— aucune : pas de persistance")]
    API["API OpenAI\n(gpt-image-1.5 — modèle de base,\n/v1/images/edits)"]

    FE -->|POST photo + STP| BK
    BK --> AUTH
    AUTH -->|Bearer token| API
    API -->|image générée| BK
    BK -->|image PNG| FE
    GHP -.héberge.-> FE
    CFW -.héberge.-> BK
    BK -.aucun appel.-> DB
```

## Structure du dépôt

```
index.html, app.js, style.css, styles.config.js   → site Cloudflare Pages
stp/                                                → bibliothèque de STP (un par style)
assets/styles/                                      → miniatures avant/après des styles
scripts/generate-stp.mjs                            → génère un .stp.json à partir d'une photo de référence
worker/                                              → Cloudflare Worker (proxy OpenAI)
Prompt1.md                                           → prompt d'analyse (photo → STP)
Prompt2.md                                           → prompt de génération (photo + STP → image)
```

## 1. Déployer le Worker Cloudflare

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
```

Édite `worker/wrangler.toml` et remplace `ALLOWED_ORIGIN` par l'origine
exacte de ton site Cloudflare Pages (ex. `https://photo-pro.pages.dev` ou ton
domaine personnalisé).

```bash
npx wrangler deploy
```

Note l'URL affichée (`https://photo-pro-worker.<sous-domaine>.workers.dev`)
et colle-la dans `app.js`, constante `WORKER_URL` (en haut du fichier).

## 2. Publier le site sur Cloudflare Pages

```bash
git init
git add .
git commit -m "Photo Pro"
git branch -M main
git remote add origin https://github.com/<toi>/<repo>.git
git push -u origin main
```

Puis crée le projet Pages :

- **Dashboard Cloudflare → Workers & Pages → Create → Pages → Connect to
  Git**, sélectionne le dépôt, laisse la commande de build vide et le
  répertoire de sortie à `.` (site statique, aucun build).
- Ou en CLI : `npx wrangler pages deploy . --project-name=photo-pro`.

Note l'URL affichée (`https://photo-pro.pages.dev` ou ton domaine
personnalisé) et reporte-la dans `ALLOWED_ORIGIN` (étape 1) si ce n'est pas
déjà fait.

## 3. Ajouter un style

1. Trouve (ou prends) une photo de référence représentant le style voulu.
2. Génère son STP :

   ```bash
   export OPENAI_API_KEY=sk-...
   node scripts/generate-stp.mjs chemin/vers/reference.jpg stp/mon-style.stp.json
   ```

3. Ajoute deux miniatures avant/après dans `assets/styles/` (optionnel mais
   recommandé — c'est ce qui s'affiche dans le sélecteur de style).
4. Ajoute une entrée dans `styles.config.js` :

   ```js
   {
     id: "mon-style",
     label: "Mon Style",
     description: "Courte description.",
     stpFile: "stp/mon-style.stp.json",
     beforeImage: "assets/styles/mon-style-before.jpg",
     afterImage: "assets/styles/mon-style-after.jpg",
   }
   ```

Le style "Executive Studio" déjà présent (`stp/executive-studio.stp.json`)
sert d'exemple de référence pour le format attendu.

## Tester en local

```bash
npx serve .
```

(ou tout serveur statique — `fetch()` sur `/stp/*.json` nécessite `http://`,
pas `file://`).

## Notes

- Le Worker n'autorise que l'origine définie dans `ALLOWED_ORIGIN` (CORS).
- `Prompt2.md` est dupliqué dans `worker/src/index.js` (le Worker ne peut pas
  lire un fichier du dépôt à l'exécution) : si tu modifies `Prompt2.md`,
  reporte le changement dans le Worker puis redéploie.
- Les images générées ne sont pas stockées — elles transitent uniquement le
  temps de la requête.
