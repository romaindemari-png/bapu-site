# BACKLOG — BAPU Aix-Marseille

Ce qui reste à faire. Cocher au fur et à mesure. Un point = un chantier = un commit (voir méthode dans [CLAUDE.md](CLAUDE.md)).

## À faire avant livraison / mise en prod

- [ ] **Licence Neue Machina (Pangram Pangram)** — vérifier que le webfont **self-hosted** (`fonts/neuemachina-*.woff2`, y compris l'inktrap `NMI`) est **couvert par une licence web valide** AVANT livraison au client. C'est une police commerciale. *(Elms Sans est une Google Font — licence OK.)*
- [x] **Bascule sur le domaine `bapuaixmarseille.fr`** — faite le 06/10 (DNS chez OVH : A @ et www → Netlify 75.2.60.5, AAAA supprimés, mails OVH/MX intacts, SSL Let's Encrypt actif).
- [ ] **Mettre à jour `deploy.url`** dans `lestud.manifest.json` → `https://bapuaixmarseille.fr`.
- [ ] **Relecture juridique** des 2 pages légales (mentions légales + politique de confidentialité) **par un avocat**.
- [ ] **Confirmer auprès du client** : directeur de la publication (actuellement *Dr Alain Gavaudan*) et référente données / RGPD (actuellement *Mme Marie Christine Perez*).

## Améliorations

- [ ] **Logos partenaires** dans le footer — actuellement en **texte** (liste `.fpartners`). À remplacer par les logos officiels (avec accord/usage vérifié).
- [ ] **Adresse de Marseille éditable → la carte doit suivre.** Hors v1 de l'admin : l'adresse figure encore en dur dans la section carte (`.map-ph-addr`, `.mapaddr`, et l'adresse codée dans `data-embed` + le lien « Ouvrir dans Google Maps »). Le jour où elle devient éditable, ces emplacements doivent lire la **même source** que `_data/coordonnees.json` — sinon le client change son adresse et la carte affiche l'ancienne.
- [ ] **Page / déclaration d'accessibilité** — le lien « Accessibilité » du footer est encore en `href="#"` sur toutes les pages. Créer la page et brancher les liens.

## Hors BAPU — constaté pendant le chantier admin (05/10/2026)

- [ ] **Relais invite/recovery absent sur d'autres LeLab.** Le mail d'invitation et le mail de réinitialisation Netlify mènent à `/#invite_token=…` / `/#recovery_token=…`, donc au **site public**. Sans le relais (`<script>` en tête de `index.html` qui renvoie vers `/admin`, cf. master `lestud-template-food` index.html L10-18), le client ne peut ni activer son compte ni changer son mot de passe.
  - **masamadre-lelab** : relais absent → porter le correctif.
  - À vérifier (relais absent dans la copie locale, sans test du flux réel) : **georges-maquette** (faire `git pull` d'abord : admin en prod) et **courtier-site** (admin actus — peut-être couvert autrement).
  - Présent : lestud-template-food, bistrot-sassy, bapu-site.

## Choix assumés (à réévaluer seulement si exigence explicite)

- [ ] **Contrastes sous AA, assumés par choix de charte** :
  - blanc sur bleu (footer) ≈ **2.7:1**
  - blanc sur vert (pictos) ≈ **3.08:1**

  Ce sont des couleurs de charte **fournies par le client**. À ne réévaluer que si une conformité **WCAG AA** est explicitement exigée (il faudrait alors assombrir les fonds ou changer la couleur de texte — donc toucher à la charte, avec accord client).
