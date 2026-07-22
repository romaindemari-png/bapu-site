# BACKLOG — BAPU Aix-Marseille

Ce qui reste à faire. Cocher au fur et à mesure. Un point = un chantier = un commit (voir méthode dans [CLAUDE.md](CLAUDE.md)).

## À faire avant livraison / mise en prod

- [ ] **Licence Neue Machina (Pangram Pangram)** — vérifier que le webfont **self-hosted** (`fonts/neuemachina-*.woff2`, y compris l'inktrap `NMI`) est **couvert par une licence web valide** AVANT livraison au client. C'est une police commerciale. *(Elms Sans est une Google Font — licence OK.)*
- [ ] **Repasser `INFO.memoriser` à `true`** dans `js/main.js` avant la vraie mise en prod (actuellement `false` = mode démo, la popup revient à chaque chargement).
- [ ] **Bascule sur le domaine `bapuaixmarseille.fr`** (config Netlify + DNS) + mettre à jour `deploy.url` dans `lestud.manifest.json`.
- [ ] **Relecture juridique** des 2 pages légales (mentions légales + politique de confidentialité) **par un avocat**.
- [ ] **Confirmer auprès du client** : directeur de la publication (actuellement *Dr Alain Gavaudan*) et référente données / RGPD (actuellement *Mme Marie Christine Perez*).

## Améliorations

- [ ] **Logos partenaires** dans le footer — actuellement en **texte** (liste `.fpartners`). À remplacer par les logos officiels (avec accord/usage vérifié).
- [ ] **Page / déclaration d'accessibilité** — le lien « Accessibilité » du footer est encore en `href="#"` sur toutes les pages. Créer la page et brancher les liens.

## Choix assumés (à réévaluer seulement si exigence explicite)

- [ ] **Contrastes sous AA, assumés par choix de charte** :
  - blanc sur bleu (footer) ≈ **2.7:1**
  - blanc sur vert (pictos) ≈ **3.08:1**

  Ce sont des couleurs de charte **fournies par le client**. À ne réévaluer que si une conformité **WCAG AA** est explicitement exigée (il faudrait alors assombrir les fonds ou changer la couleur de texte — donc toucher à la charte, avec accord client).
