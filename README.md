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
js/main.js                          Tout le JS (+ objet INFO de config, voir ci-dessous)
js/lenis.min.js                     Lenis (ne pas modifier)
fonts/  img/                        Polices .woff2, images .webp/.png
```

## Réglages

### Message d'information (popup ou bandeau)

Tout se pilote depuis l'objet **`const INFO`** en haut de **`js/main.js`** — un seul endroit à éditer :

```js
const INFO = {
  actif:     true,                 // false = rien ne s'affiche
  type:      "popup",              // "popup" (modale) | "banniere" (barre haute)
  id:        "fermeture-aout-2026",// CHANGER l'id => réaffiche à tous, même à ceux qui avaient fermé
  dateDebut: "2026-07-15",         // "AAAA-MM-JJ" (vide = tout de suite)
  dateFin:   "2026-08-28",         // "AAAA-MM-JJ" (vide = pas d'expiration)
  label:     "Information",
  titre:     "Fermeture annuelle",
  texte:     "…",                  // HTML simple autorisé (<strong>…)
  urgences:  true,                 // affiche le bloc "urgences" dans la popup
  memoriser: false                 // voir avertissement ci-dessous
};
```

- **Désactiver le message** : `actif: false` (ou laisser passer `dateFin`).
- **Le message ne s'affiche que si** : `actif` **ET** date du jour dans la plage **ET** pas déjà fermé par le visiteur.
- **`memoriser`** : `true` = ne réapparaît plus une fois fermé (comportement normal). `false` = s'affiche à **chaque** chargement (mode démo, localStorage ignoré).

> ⚠️ **`memoriser` est actuellement à `false` (mode démo). Le repasser à `true` avant la vraie mise en prod.**

### Carte (accueil)

La carte se charge **au clic** (« Afficher la carte »), pour raisons RGPD : aucune donnée n'est transmise à Google tant que le visiteur n'a pas cliqué. Ne pas remettre d'iframe Google chargée d'office.

## Bon à savoir

- Une seule feuille de style, un seul fichier JS applicatif : pas de modularisation, c'est voulu (site petit, zéro build).
- Accessibilité : `prefers-reduced-motion` respecté partout ; focus visible ; navigation clavier sur la popup. Quelques contrastes sont sous AA par choix de charte (voir BACKLOG).
