/* ============================================================
   LeLab santé — admin (coquille)
   GÉNÉRIQUE FAMILLE SANTÉ : aucune valeur client ici. Tout ce qui
   est propre au cabinet (nom, cartes, libellés) vient de
   _data/config.json ; les contenus, des _data/*.json qu'il déclare.

   S'appuie sur lelab-auth.js (cœur du master, à l'octet) qui fournit :
   session, customLogin, getToken, authedFetch, restoreSession,
   handleAuthHash, submitNewPassword, _json, etatDonnees.
   Et lui fournit en retour : boot(user), showToast(msg).
   ============================================================ */

/* ── Données en mémoire ── */
let donnees = { config: null };   // config + un fichier par carte : donnees[<fichier>]

/* ── Pictos (constantes du code, jamais une donnée). Seul « lieu » sert : l'encart d'édition. Les clés
   admin.picto de config.json ne sont plus lues depuis B3 (cartes sans picto) ; elles restent dans la donnée. ── */
const PICTOS = {
  lieu:    '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'
};

/* Petit constructeur DOM — jamais d'innerHTML avec une donnée. */
function el(tag, attrs, enfants){
  const n = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
  });
  (enfants || []).forEach(c => c && n.appendChild(c));
  return n;
}

/* ── Cartes déclarées par config.json (socle puis optionnels) ── */
function toutesLesCartes(){
  const b = (donnees.config && donnees.config.blocs) || {};
  const cartes = [];
  for (const groupe of [b.socle, b.optionnels]){
    for (const [cle, bloc] of Object.entries(groupe || {})){
      if (!bloc || bloc.actif === false) continue;
      const lst = Array.isArray(bloc.admin) ? bloc.admin : [bloc.admin || {}];
      lst.forEach(a => {
        if (!a.edit) return;
        cartes.push({ cle, type: bloc.type || cle, label: a.label || bloc.label, action: a.action || bloc.action || bloc.label,
                      edit: a.edit, fichier: a.fichier || cle, picto: a.picto, sub: a.sub || '',
                      emplacement: a.emplacement || null, aides: a.aides || {},
                      libelles: (a.libelles && typeof a.libelles === 'object' && !Array.isArray(a.libelles)) ? a.libelles : {} });
      });
    }
  }
  return cartes;
}

/* ── Chargement : config d'abord, puis les fichiers qu'elle déclare ── */
async function loadData(){
  const config = await _json('config');
  donnees = { config };
  const fichiers = [...new Set(toutesLesCartes().map(c => c.fichier))];
  await Promise.all(fichiers.map(async f => { donnees[f] = await _json(f); }));
}

/* ── Écrans ── */
/* Deux écrans depuis B2 : « Mon site » (l'accueil) et l'édition. Plus de sidebar ni de nav du bas. */
function showScreen(nom){
  fermerVoletCompte();
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + nom));
  document.body.classList.toggle('en-edition', nom === 'edit');
  window.scrollTo(0, 0);
}

/* ── Accueil ── */
function dateFr(iso){
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
function aujourdhui(d = new Date()){
  const m = d.getMonth() + 1, j = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
}
/* État du message, calculé EXACTEMENT comme le site (main.js) : actif, puis bornes incluses. */
function etatMessage(info){
  if (!info) return { val: 'Indisponible', sub: 'Lecture impossible pour le moment.' };
  if (!info.actif) return { val: 'Désactivé', sub: 'Aucun message sur le site.' };
  const t = aujourdhui(), format = info.type === 'banniere' ? 'Bannière' : 'Popup';
  if (info.dateFin && t > info.dateFin) return { val: 'Terminé', sub: 'Fin le ' + dateFr(info.dateFin) + ' · plus affiché.' };
  if (info.dateDebut && t < info.dateDebut) return { val: 'Programmé', sub: format + ' à partir du ' + dateFr(info.dateDebut) + '.' };
  return { val: 'En ligne', sub: format + (info.dateFin ? ' jusqu\'au ' + dateFr(info.dateFin) : ' sans date de fin') + '.' };
}
/* ── La phrase d'accueil (LELAB-DESIGN §4) : le salut, puis l'état RÉEL du site en une phrase. ──
   BAPU n'a qu'une source « à voir » : le message d'info. Il est à voir quand il s'arrête dans 7 jours
   ou moins (en ligne), ou quand il est terminé mais encore actif. Désactivé ou programmé : à jour.
   ⚠️ etatDuMessage est la SEULE règle : la phrase la lit, la carte du message la lira (B3). */
const JOUR_MS = 86400000;
function joursEntre(isoA, isoB){   // dates locales AAAA-MM-JJ, sans heure : écart en jours entiers
  const d = iso => { const [a, m, j] = iso.split('-').map(Number); return Date.UTC(a, m - 1, j); };
  return Math.round((d(isoB) - d(isoA)) / JOUR_MS);
}
function etatDuMessage(info, maintenant){
  if (!info) return { etat: 'inconnu' };
  if (!info.actif) return { etat: 'masque' };
  const t = aujourdhui(maintenant);
  if (info.dateFin && t > info.dateFin) return { etat: 'a-voir', raison: 'termine' };
  if (info.dateDebut && t < info.dateDebut) return { etat: 'a-jour', raison: 'programme' };
  if (info.dateFin){
    const reste = joursEntre(t, info.dateFin);
    if (reste <= 7) return { etat: 'a-voir', raison: 'expire', reste };
  }
  return { etat: 'a-jour', raison: 'en-ligne' };
}
const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/* Quand le message s'arrête, dit comme on le dirait : ce soir, demain, samedi, mercredi 4 novembre. */
function quandFin(iso, reste){
  if (reste === 0) return 'ce soir';
  if (reste === 1) return 'demain';
  const [a, m, j] = iso.split('-').map(Number), d = new Date(a, m - 1, j);
  return reste < 7 ? JOURS_SEMAINE[d.getDay()] : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function prenomDuProfil(){ return (((donnees.config || {}).cabinet || {}).prenom || '').trim(); }
function salutation(maintenant){
  const prenom = prenomDuProfil();
  return (maintenant.getHours() < 18 ? 'Bonjour' : 'Bonsoir') + (prenom ? ' ' + prenom : '') + '.';
}
/* Initiales de l'avatar : celles du prénom (Marie-Christine → MC), sinon celles du cabinet. */
function initialesAvatar(){
  const source = prenomDuProfil() || (((donnees.config || {}).cabinet || {}).nom || '');
  return source.replace(/[^A-Za-zÀ-ÿ\s-]/g, ' ').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(m => m[0].toUpperCase()).join('');
}
function renderAccueil(){
  const maintenant = new Date();
  const cabinet = ((donnees.config || {}).cabinet || {});
  /* Le prénom reste d'un seul tenant : « Marie-Christine » ne se coupe pas au trait d'union. */
  const salut = document.getElementById('accueilSalut'), prenom = prenomDuProfil();
  salut.textContent = '';
  if (prenom) salut.append(salutation(maintenant).slice(0, -(prenom.length + 1)), el('span', { class: 'insecable', text: prenom }), '.');
  else salut.textContent = salutation(maintenant);
  const etat = document.getElementById('accueilEtat');
  etat.textContent = '';
  const carteMsg = toutesLesCartes().find(c => c.type === 'message');
  const info = carteMsg ? donnees[carteMsg.fichier] : null;
  const e = carteMsg ? etatDuMessage(info, maintenant) : { etat: 'inconnu' };
  if (e.raison === 'expire'){
    etat.append('Votre message s’arrête ', el('em', { text: quandFin(info.dateFin, e.reste) }), '.');
  } else {
    etat.textContent = e.raison === 'termine' ? 'Votre message est terminé.' : 'Votre site est à jour.';
  }
  document.getElementById('avatarInit').textContent = initialesAvatar();
  document.getElementById('voletNom').textContent = prenomDuProfil() || cabinet.nom || '';
  document.getElementById('voletCabinet').textContent = prenomDuProfil() ? (cabinet.nom || '') : '';
}

/* ═══ LE VOLET DU COMPTE — ouvert par l'avatar, fermé dehors, par Échap ou par un second toucher ═══ */
function voletCompteOuvert(){ const v = document.getElementById('voletCompte'); return !!(v && !v.hidden); }
function ouvrirVoletCompte(){
  const v = document.getElementById('voletCompte'), a = document.getElementById('avatarInit');
  if (!v) return;
  v.hidden = false; if (a) a.setAttribute('aria-expanded', 'true');
}
function fermerVoletCompte(){
  const v = document.getElementById('voletCompte'), a = document.getElementById('avatarInit');
  if (!v) return;
  v.hidden = true; if (a) a.setAttribute('aria-expanded', 'false');
}
function basculerVoletCompte(){ voletCompteOuvert() ? fermerVoletCompte() : ouvrirVoletCompte(); }
/* pointerdown, pas click : le toucher dehors ferme AVANT qu'un autre geste parte. Le second toucher sur
   l'avatar est dans .compte : c'est basculerVoletCompte qui le referme. */
document.addEventListener('pointerdown', e => {
  const c = document.getElementById('compte');
  if (voletCompteOuvert() && c && !c.contains(e.target)) fermerVoletCompte();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !voletCompteOuvert()) return;
  fermerVoletCompte();
  const a = document.getElementById('avatarInit'); if (a) a.focus();
});

/* ── Mon site : une carte par écran d'édition déclaré (B3, LELAB-DESIGN §2 et §4) ──
   ⚠️ L'ORDRE EST CELUI DU SITE TEL QU'ON LE VOIT, lu dans index.html le 28/10 : le message vient en
      premier (bannière FIXÉE en haut de la page d'accueil — #infoBan, position:fixed;top:0 — ou fenêtre
      ouverte à l'arrivée — #infoPop), même s'il est écrit en fin de DOM ; les numéros et adresses
      suivent (menu L12, hero L34, #rdv, #infos, pied de page). Un type inconnu se range après.
   ⚠️ LA COULEUR DIT L'ÉTAT (§2) : papier = à jour, violet = à voir, contour pointillé = masqué. Le
      surtitre dit pourquoi. La règle est etatDuMessage, la même que la phrase d'accueil.
   ⚠️ Rien du site BAPU n'entre ici : les vraies valeurs, en encre LeLab, jamais sur blanc. */
const ORDRE_DU_SITE = ['message', 'coordonnees'];
const SVG_FLECHE_HAUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>';
const dateCourte = iso => { const [a, m, j] = iso.split('-').map(Number); return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
const dateJJMM = iso => { const [, m, j] = iso.split('-'); return j + '/' + m; };

/* Le message : état, surtitre (le mot qui explique l'état), et son signe (titre du message, format). */
function carteMessage(info, maintenant){
  const e = etatDuMessage(info, maintenant);
  let sur;
  if (e.etat === 'masque') sur = 'Masqué';
  else if (e.raison === 'termine') sur = 'Terminé le ' + dateJJMM(info.dateFin) + ' : à retirer ou à remplacer';
  else if (e.raison === 'programme') sur = 'Programmé le ' + dateCourte(info.dateDebut);
  else sur = info.dateFin ? 'Jusqu’au ' + dateCourte(info.dateFin) : 'Sans date de fin';
  const signe = [
    el('span', { class: 's-titre', text: info.titre || 'Sans titre' }),
    el('span', { class: 's-format', text: (info.type === 'banniere' ? 'Bannière' : 'Fenêtre') + ' · page d’accueil' })
  ];
  return { etat: e.etat === 'inconnu' ? 'a-jour' : e.etat, sur, signe };
}
/* Les adresses : téléphone = le standard en grand ; desktop = quatre lignes à filets (CSS). */
function carteCoordonnees(coord){
  const tels = (coord && coord.telephones) || {}, sites = (coord && Array.isArray(coord.sites)) ? coord.sites : [];
  const ligne = (lib, val, tel) => el('span', { class: 's-ligne' + (tel ? ' s-ligne--tel' : '') }, [el('span', { class: 's-lib', text: lib }), el('span', { class: 's-val', text: val })]);
  const lignes = [];
  if (tels.standard) lignes.push(ligne('Standard · Marseille et Aix', tels.standard, true));
  if (tels.portable) lignes.push(ligne('Portable', tels.portable, true));
  sites.forEach(s => lignes.push(ligne(s.nom || s.cle, (Array.isArray(s.adresse) ? s.adresse : []).join(' '))));
  const signe = [
    tels.standard ? el('span', { class: 's-mobile' }, [el('span', { class: 's-gros', text: tels.standard }), el('span', { class: 's-legende', text: 'Standard · Marseille et Aix' })]) : null,
    el('span', { class: 's-lignes' }, lignes)
  ];
  return { etat: 'a-jour', sur: '', signe };
}

function renderSiteCards(){
  const zone = document.getElementById('siteCards');
  zone.textContent = '';
  const rang = c => { const i = ORDRE_DU_SITE.indexOf(c.type); return i < 0 ? ORDRE_DU_SITE.length : i; };
  const cartes = toutesLesCartes().sort((a, b) => rang(a) - rang(b));
  if (!cartes.length){
    zone.appendChild(el('p', { class: 'cards-vide', text: 'Configuration indisponible pour le moment. Rechargez la page dans un instant.' }));
    return;
  }
  const maintenant = new Date();
  cartes.forEach((c, i) => {
    const num = String(i + 1).padStart(2, '0');
    const enPanne = etatDonnees[c.fichier] === 'erreur';
    const d = donnees[c.fichier];
    const v = enPanne ? { etat: 'a-voir', sur: 'Lecture impossible pour le moment', signe: [] }
      : c.type === 'message' ? carteMessage(d || {}, maintenant)
      : c.type === 'coordonnees' ? carteCoordonnees(d)
      : { etat: 'a-jour', sur: '', signe: [el('span', { class: 's-format', text: c.sub })] };
    const titre = c.type === 'message' ? 'Message d’info' : c.type === 'coordonnees' ? 'Adresses & téléphones' : c.label;
    const grain = v.etat === 'a-voir' ? ' grain-a-voir' : v.etat === 'masque' ? '' : ' grain-papier';
    const fl = el('span', { class: 'arrow' }); fl.innerHTML = SVG_FLECHE_HAUT;
    const carte = el('button', { class: 'card card--' + v.etat + grain, type: 'button', 'data-edit': c.edit, 'data-etat': v.etat }, [
      el('span', { class: 'card-tete' }, [
        el('span', { class: 'card-tete-txt' }, [
          el('span', { class: 'card-sur', text: num + (v.sur ? ' · ' + v.sur : '') }),
          el('span', { class: 'card-t', text: titre })
        ]),
        fl
      ]),
      el('span', { class: 'card-signe' }, v.signe)
    ]);
    carte.addEventListener('click', () => openEdit(c));
    zone.appendChild(carte);
  });
}

/* ════ ÉDITION ════════════════════════════════════════════════════════════
   Un éditeur par TYPE de bloc (config.json → bloc.type) : textes, coordonnees,
   message. Chaque éditeur rend { noeud, lire() } ; lire() renvoie la donnée à
   écrire, ou lève une Error dont le message est montré au client.

   ⚠️ UN ÉDITEUR NE DÉTRUIT JAMAIS CE QU'IL N'AFFICHE PAS (règle du master) :
      on repart de l'objet chargé ({...origine}) et on ne remplace que les champs
      édités. Les clés inconnues sont restituées telles quelles, à leur place.
   ⚠️ UN CHAMP NON TOUCHÉ SE RÉÉCRIT TEL QUEL : si la saisie vaut encore sa
      valeur initiale, on réécrit l'ORIGINE (pas une version retaillée/convertie).
      Ouvrir un écran et publier sans rien changer doit réécrire le fichier à
      l'octet près (scripts/test-allerretour.js).
   ════════════════════════════════════════════════════════════════════════ */

let edition = null;   // { carte, origine, lire, sale }

/* Texte riche minimal : stockage HTML (<strong>, <br>) ↔ saisie (**gras**, retour à la ligne).
   main.js n'interprète que ces deux balises : tout le reste s'affiche comme du texte. */
function versSaisie(html){
  return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
}
function versHTML(saisie){
  return String(saisie || '').replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>').replace(/\r?\n/g, '<br>');
}
/* Même règle que le loader du site : 0X XX XX XX XX, ou +indicatif. */
function telValide(num){
  const c = String(num).replace(/\D/g, '');
  return /^0\d{9}$/.test(c) || (/^\s*\+/.test(num) && c.length >= 8);
}
/* Début lisible d'un texte stocké (balises retirées), coupé au mot. */
function debutDe(html, max = 70){
  const t = String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const c = t.slice(0, max); return c.slice(0, c.lastIndexOf(' ') > 30 ? c.lastIndexOf(' ') : max) + '…';
}
/* Saisie inchangée → valeur d'origine, à l'octet. */
function garde(champ, origine){ return champ.value === champ.dataset.initial ? origine : champ.value.trim(); }

function champ(tag, attrs, valeur){
  const n = el(tag, attrs);
  n.value = valeur == null ? '' : valeur;
  n.dataset.initial = n.value;
  return n;
}
function groupe(libelle, controle, aide){
  const id = 'f-' + Math.random().toString(36).slice(2, 8);
  controle.id = id;
  return el('div', { class: 'fld' }, [el('label', { for: id, text: libelle }), controle, aide ? el('p', { class: 'fld-aide', text: aide }) : null]);
}
function interrupteur(libelle, coche){
  const box = el('input', { type: 'checkbox', role: 'switch' });
  box.checked = !!coche;
  const lab = el('label', { class: 'switch' }, [box, el('span', { class: 'switch-piste', 'aria-hidden': 'true' }), el('span', { class: 'switch-t', text: libelle })]);
  return { noeud: lab, box };
}

const EDITEURS = {

  /* ── Paragraphes d'un bloc de texte : donnee[carte.cle] = [{texte, fort}] ── */
  textes(carte, donnee){
    const cle = carte.cle;
    const liste = Array.isArray(donnee && donnee[cle]) ? donnee[cle] : [];
    const zone = el('div', { class: 'ed-liste' });
    const lignes = [];
    /* Libellé de rôle : le paragraphe porte son rôle (textes.json → role), config.json le traduit
       (admin.libelles[role]). Le libellé suit donc le texte, pas la position. Paragraphe sans
       rôle (nouveau, ou fichier non migré) : numérotation. */
    function ajouter(origine){
      const libelle = origine && origine.role ? carte.libelles[origine.role] : undefined;
      const ta = champ('textarea', { rows: '3' }, origine ? origine.texte : '');
      const gras = interrupteur('En gras', origine ? origine.fort : false);
      const suppr = el('button', { type: 'button', class: 'ed-suppr', 'aria-label': 'Supprimer ce paragraphe', text: 'Supprimer' });
      const repere = el('p', { class: 'ed-apercu' }, origine
        ? [el('span', { text: 'Sur le site actuellement : ' }), el('q', { text: debutDe(origine.texte) })]
        : [el('span', { text: 'Nouveau paragraphe — il s’ajoutera à la suite des autres.' })]);
      const bloc = el('div', { class: 'ed-carte grain-papier' }, [el('div', { class: 'ed-carte-h' }, [el('span', { class: 'ed-num' }), suppr]), repere, groupe('Texte', ta), gras.noeud]);
      const ligne = { origine, ta, gras: gras.box, bloc, libelle };
      suppr.addEventListener('click', () => {
        if (lignes.length <= 1){ showToast('Il faut au moins un paragraphe.'); return; }
        lignes.splice(lignes.indexOf(ligne), 1); bloc.remove(); numeroter(); signalerSaisie();
      });
      lignes.push(ligne); zone.appendChild(bloc); numeroter();
      return ligne;
    }
    function numeroter(){ lignes.forEach((l, i) => { l.bloc.querySelector('.ed-num').textContent = l.libelle || ((i === 0 ? '1er' : (i + 1) + 'e') + ' paragraphe'); }); }
    (liste.length ? liste : [null]).forEach(o => ajouter(o));
    const plus = el('button', { type: 'button', class: 'ed-ajout', text: '+ Ajouter un paragraphe' });
    plus.addEventListener('click', () => { ajouter(null).ta.focus(); signalerSaisie(); });
    return {
      noeud: el('div', {}, [zone, plus]),
      lire(){
        const paras = lignes.map(l => {
          const texte = garde(l.ta, l.origine && l.origine.texte);
          if (!String(texte || '').trim()) throw new Error('Un paragraphe est vide : remplissez-le ou supprimez-le.');
          return l.origine ? { ...l.origine, texte, fort: l.gras.checked } : { texte, fort: l.gras.checked };
        });
        return { ...(donnee || {}), [cle]: paras };
      }
    };
  },

  /* ── Adresses et téléphones : donnee.sites = [{cle, nom, adresse[], telephone?}]
     + donnee.telephones = {standard, portable} (optionnel, numéros communs à tous les sites).
     Le champ téléphone d'un site n'apparaît que si ce site a un `telephone`. ── */
  coordonnees(carte, donnee){
    const sites = Array.isArray(donnee && donnee.sites) ? donnee.sites : [];
    const zone = el('div', { class: 'ed-liste' });
    const lignes = sites.map(s => {
      const adr = Array.isArray(s.adresse) ? s.adresse : [];
      const champsAdr = [0, 1].concat(adr.slice(2).map((_, i) => i + 2)).map(i =>
        champ('input', { type: 'text', autocomplete: 'off' }, adr[i] || ''));
      const tel = 'telephone' in s ? champ('input', { type: 'tel', inputmode: 'tel', autocomplete: 'off' }, s.telephone || '') : null;
      const lieu = s.nom || s.cle;
      const aides = carte.aides || {};
      zone.appendChild(el('div', { class: 'ed-carte grain-papier' }, [
        el('div', { class: 'ed-carte-h' }, [el('span', { class: 'ed-num', text: lieu })]),
        ...champsAdr.map((c, i) => groupe(lieu + ' — adresse, ligne ' + (i + 1), c, i === champsAdr.length - 1 ? aides.adresse : null)),
        tel ? groupe(lieu + ' — téléphone', tel, [aides.telephone, 'Format : 04 91 50 01 13'].filter(Boolean).join(' ')) : null
      ]));
      return { site: s, champsAdr, tel, adr };
    });
    const communs = donnee && donnee.telephones && typeof donnee.telephones === 'object' ? donnee.telephones : null;
    const TYPES = [['standard', 'Standard'], ['portable', 'Portable']];
    const champsTel = communs ? TYPES.map(([type, libelle]) => ({ type, libelle,
      c: champ('input', { type: 'tel', inputmode: 'tel', autocomplete: 'off' }, communs[type] || '') })) : [];
    if (communs){
      const aide = [(carte.aides || {}).telephone, 'Format : 04 91 50 01 13'].filter(Boolean).join(' ');
      zone.appendChild(el('div', { class: 'ed-carte grain-papier' }, [
        el('div', { class: 'ed-carte-h' }, [el('span', { class: 'ed-num', text: 'Téléphones — Marseille & Aix' })]),
        ...champsTel.map((t, i) => groupe(t.libelle, t.c, i === champsTel.length - 1 ? aide : null))
      ]));
    }
    return {
      noeud: zone,
      lire(){
        const out = lignes.map(({ site, champsAdr, tel, adr }) => {
          const nom = site.nom || site.cle;
          const inchangee = champsAdr.every(c => c.value === c.dataset.initial);
          const adresse = inchangee ? adr : champsAdr.map(c => c.value.trim()).filter(Boolean);
          if (!adresse.length) throw new Error('Adresse vide pour ' + nom + '.');
          if (!tel) return { ...site, adresse };
          const telephone = garde(tel, site.telephone);
          if (!telValide(telephone)) throw new Error('Téléphone de ' + nom + ' non reconnu. Exemple : 04 91 50 01 13');
          return { ...site, adresse, telephone };
        });
        if (!communs) return { ...(donnee || {}), sites: out };
        const telephones = { ...communs };
        champsTel.forEach(({ type, libelle, c }) => {
          const num = garde(c, communs[type]);
          if (!telValide(num)) throw new Error('Numéro ' + libelle.toLowerCase() + ' non reconnu. Exemple : 04 91 50 01 13');
          telephones[type] = num;
        });
        return { ...(donnee || {}), sites: out, telephones };
      }
    };
  },

  /* ── Message d'info (popup / bannière) : _data/info.json ──
     ⚠️ L'ID SE RÉGÉNÈRE dès que titre, texte ou dates changent. Le site mémorise la
        fermeture PAR ID : sans nouvel id, un visiteur qui a fermé l'ancien message
        ne verrait JAMAIS le nouveau (critique pour une fermeture exceptionnelle).
        Le client ne voit jamais ce champ. */
  message(carte, donnee){
    const o = donnee || {};
    const actif = interrupteur('Afficher le message sur le site', o.actif);
    const typePop = el('input', { type: 'radio', name: 'msg-type', value: 'popup' });
    const typeBan = el('input', { type: 'radio', name: 'msg-type', value: 'banniere' });
    (o.type === 'banniere' ? typeBan : typePop).checked = true;
    const format = el('div', { class: 'fld' }, [el('span', { class: 'fld-l', text: 'Format' }), el('div', { class: 'seg' }, [
      el('label', {}, [typePop, el('span', { text: 'Popup' })]), el('label', {}, [typeBan, el('span', { text: 'Bannière en haut' })])])]);
    const label = champ('input', { type: 'text' }, o.label);
    const titre = champ('input', { type: 'text' }, o.titre);
    const texteInitial = versSaisie(o.texte);
    const texte = champ('textarea', { rows: '4' }, texteInitial);
    const debut = champ('input', { type: 'date' }, o.dateDebut);
    const fin = champ('input', { type: 'date' }, o.dateFin);
    const urg = interrupteur('Afficher les numéros d’urgence', o.urgences);
    const groupeLabel = groupe('Petit intitulé (au-dessus du titre)', label);
    const groupeUrg = el('div', { class: 'fld' }, [urg.noeud, el('p', { class: 'fld-aide', text: 'Les numéros eux-mêmes ne se modifient pas ici.' })]);
    /* ⚠️ C'est la CARTE qu'on masque en bannière, pas seulement le champ : masquer le seul
          champ laissait une carte vide (padding + bordure, 34 px) sous les dates. */
    const carteUrg = el('div', { class: 'ed-carte grain-papier' }, [groupeUrg]);
    const apercu = el('p', { class: 'ed-etat' });

    const MODELES = [
      { nom: 'Fermeture annuelle', label: 'Information', titre: 'Fermeture annuelle' },
      { nom: 'Fermeture exceptionnelle', label: 'Information', titre: 'Fermeture exceptionnelle' },
      { nom: 'Information', label: 'Information', titre: '' }
    ];
    const modeles = el('div', { class: 'chips' }, MODELES.map(m => {
      const b = el('button', { type: 'button', class: 'chip', text: m.nom });
      b.addEventListener('click', () => { label.value = m.label; titre.value = m.titre; (m.titre ? texte : titre).focus(); signalerSaisie(); });
      return b;
    }));

    const nouvelId = 'msg-' + Date.now().toString(36);   // fixé à l'ouverture : stable tant qu'on reste dans l'écran
    function lireBrut(){
      const t = garde(titre, o.titre), d = debut.value, f = fin.value;
      const tx = texte.value === texteInitial ? o.texte : versHTML(texte.value.trim());
      const contenuChange = t !== o.titre || tx !== o.texte || d !== (o.dateDebut || '') || f !== (o.dateFin || '');
      return { ...o,
        actif: actif.box.checked,
        type: typeBan.checked ? 'banniere' : 'popup',
        id: (contenuChange || !o.id) ? nouvelId : o.id,
        dateDebut: d, dateFin: f,
        label: garde(label, o.label), titre: t, texte: tx,
        urgences: urg.box.checked,
        memoriser: o.memoriser !== undefined ? o.memoriser : true };
    }
    function majApercu(){
      const r = lireBrut();
      groupeLabel.hidden = carteUrg.hidden = r.type === 'banniere';
      const e = etatMessage(r);
      apercu.textContent = 'Avec ces réglages : ' + e.val + ' — ' + e.sub;
      apercu.dataset.etat = e.val;
    }
    const noeud = el('div', { class: 'ed-liste' }, [
      el('div', { class: 'ed-carte grain-papier' }, [actif.noeud, apercu]),
      el('div', { class: 'ed-carte grain-papier' }, [el('div', { class: 'fld' }, [el('span', { class: 'fld-l', text: 'Partir d’un modèle' }), modeles]), format, groupeLabel,
        groupe('Titre', titre), groupe('Texte', texte, 'Mettez un passage **entre deux astérisques** pour l’écrire en gras.')]),
      el('div', { class: 'ed-carte grain-papier' }, [el('div', { class: 'fld-duo' }, [groupe('Du', debut), groupe('Au (inclus)', fin)]),
        el('p', { class: 'fld-aide', text: 'Laissez vide pour commencer tout de suite / ne jamais s’arrêter. Le message s’éteint seul après la date de fin.' })]),
      carteUrg
    ]);
    noeud.addEventListener('input', majApercu);
    noeud.addEventListener('change', majApercu);
    noeud.addEventListener('click', () => setTimeout(majApercu, 0));
    majApercu();
    return {
      noeud,
      lire(){
        const r = lireBrut();
        if (r.actif && !String(r.titre || '').trim()) throw new Error('Donnez un titre au message.');
        if (r.dateDebut && r.dateFin && r.dateFin < r.dateDebut) throw new Error('La date de fin est avant la date de début.');
        return r;
      }
    };
  }
};

/* ── Garde de LECTURE, avant d'ouvrir comme avant d'écrire (règle du master) :
      'erreur' = on n'a pas pu lire le fichier → l'écran ne porterait qu'un gabarit,
      et le publier écraserait les données du client. 'absent' = création, autorisée. */
function lectureEnPanne(carte){ return etatDonnees[carte.fichier] === 'erreur'; }

function openEdit(carte){
  const fab = EDITEURS[carte.type];
  if (!fab){ showToast('Cet élément ne se modifie pas encore ici.'); return; }
  if (lectureEnPanne(carte)){ showToast('Lecture impossible pour le moment — rechargez la page avant de modifier.'); return; }
  const origine = donnees[carte.fichier];
  const ed = fab(carte, origine);
  edition = { carte, origine, lire: ed.lire, sale: false };
  document.getElementById('editTitre').textContent = carte.action;
  document.getElementById('editSub').textContent = carte.emplacement ? '' : carte.sub;
  document.getElementById('editSub').hidden = !!carte.emplacement;
  rendreEmplacement(carte.emplacement);
  const corps = document.getElementById('editCorps');
  corps.textContent = '';
  corps.appendChild(ed.noeud);
  majBoutonPublier();
  showScreen('edit');
  corps.querySelectorAll('textarea').forEach(ajusterHauteur);   // après affichage : scrollHeight vaut 0 sur un écran masqué
}

/* Encart « Où sur le site » — textes fournis par config.json (admin.emplacement). */
function rendreEmplacement(e){
  const zone = document.getElementById('editLieu');
  zone.textContent = '';
  zone.hidden = !e;
  if (!e) return;
  const ico = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ico.setAttribute('viewBox', '0 0 24 24'); ico.setAttribute('aria-hidden', 'true');
  ico.innerHTML = PICTOS.lieu;
  zone.append(el('span', { class: 'lieu-ico' }, [ico]), el('div', { class: 'lieu-txt' }, [
    el('p', { class: 'lieu-sur', text: 'Ce que vous modifiez sur le site' }),
    el('p', { class: 'lieu-t', text: e.titre || '' }),
    e.texte ? el('p', { class: 'lieu-p', text: e.texte }) : null,
    e.ancre !== undefined ? el('a', { class: 'lieu-lien', href: '/' + (e.ancre || ''), target: '_blank', rel: 'noopener', text: 'Voir cet endroit sur le site ↗' }) : null
  ]));
}

/* Modifié = ce qu'on écrirait diffère de ce qu'on a lu (une saisie invalide compte comme modifiée). */
function signalerSaisie(){
  if (!edition) return;
  let sale;
  try { sale = JSON.stringify(edition.lire()) !== JSON.stringify(edition.origine); } catch(e){ sale = true; }
  edition.sale = sale;
  majBoutonPublier();
}
function majBoutonPublier(){
  const b = document.getElementById('btnPublier');
  b.disabled = !edition || !edition.sale;
  b.textContent = 'Publier les modifications';
}

async function publier(){
  if (!edition) return;
  const { carte } = edition;
  if (lectureEnPanne(carte)){ showToast('Lecture impossible — publication annulée.'); return; }
  let data;
  try { data = edition.lire(); } catch(e){ showToast(e.message); return; }
  const btn = document.getElementById('btnPublier');
  btn.disabled = true; btn.textContent = 'Publication…';
  try {
    const res = await authedFetch('/.netlify/functions/save-data', { section: carte.edit, data });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(r.error || ('HTTP ' + res.status));
    /* Écriture confirmée (200) → c'est CET état qui fait foi. Jamais de relecture du
       CDN juste après : il servirait encore l'ancien fichier pendant le redéploiement. */
    donnees[carte.fichier] = data;
    etatDonnees[carte.fichier] = 'ok';
    edition.origine = data;
    edition.sale = false;
    renderAccueil(); renderSiteCards();
    showToast('Modifications enregistrées — en ligne dans moins d’une minute');
    btn.textContent = '✓ Enregistré';
    const ecran = carte.edit;
    setTimeout(() => { if (edition && edition.carte.edit === ecran && !edition.sale) fermerEdition(); }, 1200);
  } catch(e){
    console.error('[LeLab] publication', e);
    showToast('Échec de la publication : ' + e.message);
    btn.textContent = 'Publier les modifications';
    btn.disabled = false;
  }
}

function fermerEdition(){
  edition = null;
  document.getElementById('editCorps').textContent = '';
  showScreen('monsite');
}

/* Quitter un écran modifié demande confirmation (retour, navigation, déconnexion). */
let apresConfirmation = null;
function siModifie(suite){
  if (edition && edition.sale){ apresConfirmation = suite; document.getElementById('quitter').hidden = false; return; }
  suite();
}
function confirmerQuitter(oui){
  document.getElementById('quitter').hidden = true;
  const s = apresConfirmation; apresConfirmation = null;
  if (oui && s){ edition = null; s(); }
}

/* ── Points d'accroche attendus par lelab-auth.js ── */
async function boot(user){
  document.body.classList.add('authed');
  await loadData();
  renderAccueil();
  renderSiteCards();
  showScreen('monsite');
}

let toastTimer = null;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function customLogout(){
  clearSession();
  edition = null;
  showScreen('monsite');
  document.body.classList.remove('authed');
  showToast('Déconnecté');
}
function doLogout(){ siModifie(customLogout); }

/* ── Navigation ── */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-screen]');
  if (b) siModifie(() => { edition = null; showScreen(b.dataset.screen); });
});
/* Les zones de texte grandissent avec leur contenu : tout le texte reste visible. */
function ajusterHauteur(ta){ ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
document.addEventListener('input', e => { if (e.target.matches('#editCorps textarea')) ajusterHauteur(e.target); if (e.target.closest('#editCorps')) signalerSaisie(); });
document.addEventListener('change', e => { if (e.target.closest('#editCorps')) signalerSaisie(); });
