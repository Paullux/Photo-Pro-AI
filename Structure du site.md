# Site Statique sur github page, basé sur l'API ChatGPT Images :
  
à partir d'une photo de moi puis des images de type :
- Executive Studio
- Corporate
- LinkedIn
- Startup
- Editorial
- Dark Studio
- Cinematic
- Black & White

Que l'ont pourrait récupéré sur :
- LinkedIn Corporate
- Startup CEO
- Executive Studio
- Magazine Editorial
- Harvard Business School
- Cabinet d'avocats
- Consulting (McKinsey/BCG)
- Portrait chaleureux
- Portrait sombre
- Portrait cinéma
- Portrait noir et blanc
- Portrait startup tech

trouvé sur le net, on génère des json STP de chaque type d'image

ainsi le fichier Prompt1.md contient le prompt de génération des `filename.stp.json`
  
```plain text
GitHub Pages
│
├── stp/
│     ├── corporate.stp.json
│     ├── executive.stp.json
│     ├── linkedin.stp.json
│     └── editorial.stp.json
│
└── app.js
```

```plain text
Photo de référence
        ↓
Analyse Vision (1 seule fois)
        ↓
photo.stp.json
        ↓
Stockage
        ↓
------------------------------
Utilisateur
        ↓
Photo + STP
        ↓
Génération
```

exemple de stp à générer une fois

ainsi le fichier Prompt2.md contient le prompt de génération de l'image finale

Le site ferait alors :
- Upload de la photo.
- Choix du style.
- Chargement du STP correspondant.
- Envoi de la photo + STP au modèle.
- Retour de l'image.