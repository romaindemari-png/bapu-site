# CLAUDE.md — contexte projet BAPU

Contexte destiné à toute future session Claude Code sur ce dépôt. **À lire en entier avant toute modification.**

## Le projet

Site **vitrine** du **BAPU Aix-Marseille** (Bureau d'Aide Psychologique Universitaire — soutien psychologique gratuit pour les étudiant·e·s d'Aix-Marseille).

- **Client** de **LeStud** (studio, Marseille). Le BAPU est le client final.
- **La charte graphique est fournie par le client** (couleurs, logo). On ne l'invente pas, on ne la « modernise » pas de notre propre chef.
- Objectif : site sobre, chaleureux, accessible, rapide.

## Stack & déploiement

- **HTML / CSS / JS vanilla.** Aucun framework, aucun bundler, aucune étape de build.
- **Zéro dépendance runtime externe** : les polices sont self-hosted (`fonts/`), **Lenis** (scroll fluide) est téléchargé en local (`js/lenis.min.js`). Pas de CDN.
- **Déploiement : Netlify**, automatique à chaque push sur `main`. Pas de CI, pas de tests. Un push = une mise en ligne.
- Domaine cible : **bapuaixmarseille.fr** (bascule pas encore faite — voir `BACKLOG.md`).

## Structure des fichiers

```
index.html                          Page d'accueil (une seule longue page à ancres)
mentions-legales.html               Page de texte (gabarit .legal)
politique-de-confidentialite.html   Page de texte (gabarit .legal)
css/styles.css                      TOUT le CSS (un seul fichier)
js/main.js                          TOUT le JS applicatif (hero, parallax, reveal, Lenis, popup INFO, carte, puzzle)
js/lelab-sante-loader.js            Loader LeLab santé (générique) : _data/textes + coordonnees → marqueurs cms-*
_data/                              Contenus édités par le client via l'admin (textes, coordonnees, info)
netlify/functions/save-data.js      Sauvegarde admin → GitHub via Git Gateway — copie À L'OCTET du master lestud-template-food
js/lenis.min.js                     Lenis (vendored, ne pas modifier)
fonts/                              Neue Machina (NM / NMI inktrap), Elms Sans — .woff2
img/                               Photos + pictos (versions .webp + fallback)
README.md  BACKLOG.md  CLAUDE.md
```

Les pages légales réutilisent `css/styles.css` (section scopée `.legal`) et `js/main.js` (protégé, voir invariants).

## INVARIANTS À NE JAMAIS CASSER

1. **Compo hero = PRESET 6×6 FIXE.** La grille de formes du hero est une composition figée extraite au pixel (`const PRESET` dans `js/main.js`), répétée pour remplir le panneau. **Aucune génération aléatoire de la composition.** (Seuls sont aléatoires : quelles cellules « respirent » via `breathe`, et le micro-swap du puzzle — qui **revient toujours à sa place**, l'état de repos est toujours le PRESET exact.) Ne jamais remplacer PRESET par du procédural.
2. **Parallax** (léger, desktop only) sur `.qsn .achair` et `.rdv .tel-img` via la variable CSS `--py`. Désactivé ≤ 820px et en `prefers-reduced-motion`.
3. **Grain** : `<div class="grain">` en overlay fixe (SVG turbulence en data-URI). Toujours présent en fin de `<body>`.
4. **Classe de reveal = `"shown"`, JAMAIS `"in"`.** `"in"` entre en collision avec la classe de layout `.rdv .in` (voir piège 6). Ne jamais renommer `shown` en `in`.
5. **Jamais `display:contents` pour centrer** une image / un `<picture>` : cassé sur iOS Safari (voir piège 1). Utiliser flex sur le conteneur **et** sur `<picture>`.
6. **Couleurs de charte figées** (fournies par le client — ne pas changer les valeurs) :
   - Vert `--v` **#00AA3A**
   - Bleu `--b` **#00AFF6**
   - Orange `--o` **#FF8F00**
   - Corail/rouge `--r` **#FF5243**
   - Rose `--p` **#FF8DA3** (variante `--pink` **#FF94A4**)
   - Encre (texte) `--ink` **#3B3B3B**
   - Fond papier `--paper` **#fff**, fond alt `--bg` **#F5F5F3**
   - Gris `--muted` **#9A9A9A**, filet `--hair` **#E4E3DF**
   - `--cream` **#F3EEE7** : placeholder des médias (couleur utilitaire, pas une couleur de marque)
   Les mêmes cinq couleurs vives sont dupliquées dans `js/main.js` (`const PAL`) pour les formes SVG — garder synchronisé.

## MÉTHODE DE TRAVAIL (non négociable)

- **Un changement = un commit = une validation sur iPhone RÉEL entre chaque.** Jamais de passe groupée (« jamais de groupage »).
- **Montrer le diff avant de pousser.** Pour tout changement visuel, montrer aussi le rendu (desktop + mobile ~390px) avant push.
- **DevTools ≠ iPhone réel.** Le comportement diffère (safe-area, viewport dynamique, barre d'URL). Ne pas conclure « c'est bon » depuis DevTools seul.
- **Ne jamais « nettoyer » du code prétendument mort, ni refactorer, sans demander.** Beaucoup de choses qui semblent superflues corrigent un bug précis (voir pièges).
- Pas de `--force`. Historique préservé.

## PIÈGES DÉJÀ RENCONTRÉS (symptôme → cause → solution)

1. **Image non centrée / disparue sur iPhone.**
   `display:contents` sur `<picture>` pour centrer une image **ne marche pas sur iOS Safari**. → Mettre `display:flex` sur le conteneur **ET** sur le `<picture>`.

2. **Un logo en écrase un autre (le rose du header disparaît).**
   Un `<style>` à l'intérieur d'un SVG inline est **global au document**. Deux logos partageant les classes `.cls-1`…`.cls-5` s'écrasent : le blanc du footer effaçait la couleur du header. → **Scoper** les règles (ex. `.logo-white .cls-1{fill:#fff}`).

3. **La photo « saute » / se décale au scroll.**
   CSS et JS pilotant le **même `transform`** se battent : la photo tél était positionnée en CSS puis éjectée par le parallax JS au scroll. → Positionner via `position`/`margin` (pas `transform`), **ou** exclure l'élément du JS de parallax.

4. **Une image lazy disparaît / le bloc s'effondre.**
   `loading="lazy"` **sans `width`/`height` ni `aspect-ratio`** : le conteneur tombe à 0 avant chargement, l'image disparaît. → Toujours **réserver la place** (`aspect-ratio` ou `width`/`height`).

5. **La grille hero clignote / se reconstruit en boucle sur iPhone.**
   Un handler `resize` qui reconstruit sur changement de **hauteur** boucle sur iOS (la barre d'URL fait varier la hauteur au scroll). → Ne réagir qu'aux changements de **largeur** (`if(innerWidth===lastW)return`).

6. **Collision de classe `in`.**
   La classe de reveal `"in"` écrasait la classe de layout `.rdv .in`. → Renommée **`"shown"`**. **NE JAMAIS revenir à `"in"`.**

7. **`picture{display:contents}` global (`css/styles.css` l. 1) : à NE PAS retirer.**
   Il est PRÉSENT et FONCTIONNE ici (fauteuil de « Qui sommes-nous » + téléphone de la section RDV), validé sur iPhone. Ne PAS le retirer : ces 2 `<picture>` portent le parallax et des positions mobile figées, délicates à caler. Le piège `display:contents` (piège 1, invariant 5) vaut pour le **centrage**, pas ici. Décision du 07/10/2026 (audit mobile, point B4 écarté).

## Réglages clés

- **Popup / bandeau d'information** : contenu dans `_data/info.json` (édité via l'admin), lu par `js/main.js`. Mémorisation par `id` : un nouveau message = un nouvel `id`. Voir `README.md`.
- **Contenus injectés** (textes Accueil, adresses, téléphones) : `_data/*.json` injectés par `js/lelab-sante-loader.js` via les marqueurs `cms-*` — ne pas retirer ces classes/ids du HTML.
- **Éditables par le client** : adresses, téléphones, message d'info. **Textes d'accueil FIGÉS** (validés) : toujours servis par `_data/textes.json`, mais le bloc `accueil` de `config.json` n'a plus d'`admin.edit` → pas de carte dans l'admin, et `save-data` refuse la section. Pour réactiver : remettre `"edit": "accueil"` (libellés et encart sont restés dans la config).
- **Libellés de l'admin (textes)**, si l'éditeur est réactivé : chaque paragraphe de `_data/textes.json` porte un `role` ; le libellé vient de `config.json → admin.libelles[role]`. Paragraphe sans role → numérotation. Ne jamais revenir à un libellé par position (une suppression décalerait tous les libellés).
- **Carte** (accueil) : chargement **au clic** (RGPD) — l'iframe Google n'est injectée qu'au clic sur « Afficher la carte ». Ne pas remettre d'iframe Google en dur.
