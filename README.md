# BAPU Aix-Marseille — site vitrine

Site vitrine du **BAPU Aix-Marseille** (Bureau d'Aide Psychologique Universitaire). Réalisation : **LeStud** (Marseille).

Site statique **HTML / CSS / JS vanilla** — aucun framework, aucune étape de build. Scroll fluide via [Lenis](https://github.com/darkroomengineering/lenis) (vendored en local). Polices self-hosted.

> Avant de modifier quoi que ce soit, lire **[CLAUDE.md](CLAUDE.md)** : invariants, méthode de travail et pièges déjà rencontrés.

## Lancer en local

Aucune installation. Servir le dossier avec n'importe quel serveur statique :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

(Ouvrir `index.html` par `file://` fonctionne en partie, mais un serveur évite les soucis de chemins/polices.)

## Déploiement

**Netlify**, automatique à chaque push sur `main`. Pas de CI ni de build : le contenu du dépôt est servi tel quel. Un push = une mise en ligne.

Domaine cible : **bapuaixmarseille.fr** (bascule à faire — voir [BACKLOG.md](BACKLOG.md)).

## Structure

```
index.html                          Accueil (page unique à ancres : #presentation, #rdv, #infos)
mentions-legales.html               Page de texte
politique-de-confidentialite.html   Page de texte
css/styles.css                      Tout le CSS
js/main.js                          Tout le JS (lit _data/info.json pour le message d'info)
js/lelab-sante-loader.js            Loader LeLab : injecte _data/textes + coordonnees (marqueurs cms-*)
_data/                              Contenus édités depuis l'admin (textes, coordonnees, info)
netlify/functions/save-data.js      Sauvegarde admin → GitHub via Git Gateway (copie du master LeLab)
js/lenis.min.js                     Lenis (ne pas modifier)
fonts/  img/                        Polices .woff2, images .webp/.png
```

## Réglages

### Message d'information (popup ou bandeau)

Le message se règle dans **`_data/info.json`**, édité par le client depuis l'admin LeLab (`/admin`). `js/main.js` le lit au chargement.

```jsonc
{
  "actif": true,                  // false = rien ne s'affiche
  "type": "popup",                // "popup" (modale) | "banniere" (barre haute)
  "id": "fermeture-aout-2026",    // CHANGER l'id => réaffiche à tous, même à ceux qui avaient fermé
  "dateDebut": "2026-07-15",      // "AAAA-MM-JJ" (vide = tout de suite)
  "dateFin": "2026-08-28",        // "AAAA-MM-JJ" (vide = pas d'expiration)
  "label": "Information",
  "titre": "Fermeture annuelle",
  "texte": "…",                   // seuls <strong> et <br> sont interprétés, le reste s'affiche en texte
  "urgences": true,               // affiche le bloc "urgences" (numéros EN DUR dans index.html, non éditables)
  "memoriser": true               // true = ne réapparaît plus une fois fermé
}
```

- **Le message ne s'affiche que si** : `actif` **ET** date du jour dans la plage (bornes incluses) **ET** pas déjà fermé par le visiteur.
- **`memoriser`** : `true` = comportement normal. `false` = s'affiche à **chaque** chargement (mode démo).
- ⚠️ **La mémorisation se fait par `id`.** Un nouveau message doit avoir un nouvel `id`, sinon les visiteurs qui ont fermé l'ancien ne verront pas le nouveau. L'admin le régénère lui-même.
- `info.json` absent ou illisible → aucun message.

### Carte (accueil)

La carte se charge **au clic** (« Afficher la carte »), pour raisons RGPD : aucune donnée n'est transmise à Google tant que le visiteur n'a pas cliqué. Ne pas remettre d'iframe Google chargée d'office.

## Bon à savoir

- Une seule feuille de style, un seul fichier JS applicatif : pas de modularisation, c'est voulu (site petit, zéro build).
- Accessibilité : `prefers-reduced-motion` respecté partout ; focus visible ; navigation clavier sur la popup. Quelques contrastes sont sous AA par choix de charte (voir BACKLOG).
