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

/* ── Pictos des cartes (clé `admin.picto` de config.json) ── */
const PICTOS = {
  texte:   '<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>',
  lieu:    '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  message: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  defaut:  '<rect x="4" y="4" width="16" height="16" rx="3"/>'
};
const SVG_FLECHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/* Petit constructeur DOM — jamais d'innerHTML avec une donnée. */
function el(tag, attrs, enfants){
  const n = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
  });
  (enfants || []).forEach(c => c && n.appendChild(c));
  return n;
}
function svgPicto(cle){
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = PICTOS[cle] || PICTOS.defaut;   // constantes du code, pas de donnée
  return s;
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
                      edit: a.edit, fichier: a.fichier || cle, picto: a.picto, sub: a.sub || '' });
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
function showScreen(nom){
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + nom));
  const onglet = nom === 'edit' ? 'monsite' : nom;   // l'édition appartient à « Mon site »
  document.querySelectorAll('[data-screen]').forEach(b => {
    if (b.classList.contains('nav-item') || b.classList.contains('nb-item')) b.classList.toggle('active', b.dataset.screen === onglet);
  });
  document.body.classList.toggle('en-edition', nom === 'edit');
  window.scrollTo(0, 0);
}

/* ── Accueil ── */
function dateFr(iso){
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
function aujourdhui(){
  const d = new Date(), m = d.getMonth() + 1, j = d.getDate();
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
function renderAccueil(){
  const nom = (donnees.config && donnees.config.cabinet && donnees.config.cabinet.nom) || '';
  document.getElementById('helloName').textContent = nom || 'à vous';
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('helloDate').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  document.querySelectorAll('.user-name').forEach(n => { n.textContent = nom; });
  const initiales = nom.replace(/[^A-Za-zÀ-ÿ ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(m => m[0].toUpperCase()).join('');
  document.querySelectorAll('.av').forEach(n => { n.textContent = initiales; });

  const carteMsg = toutesLesCartes().find(c => c.type === 'message');
  const tuile = document.getElementById('tileMessage');
  tuile.hidden = !carteMsg;
  if (carteMsg){
    const e = etatMessage(donnees[carteMsg.fichier]);
    document.getElementById('etatMessage').textContent = e.val;
    document.getElementById('etatMessageSub').textContent = e.sub;
    tuile.dataset.etat = e.val;
  }
}

/* ── Mon site : une carte par écran d'édition déclaré ── */
function renderSiteCards(){
  const zone = document.getElementById('siteCards');
  zone.textContent = '';
  const cartes = toutesLesCartes();
  if (!cartes.length){
    zone.appendChild(el('p', { class: 'cards-vide', text: 'Configuration indisponible pour le moment. Rechargez la page dans un instant.' }));
    return;
  }
  cartes.forEach(c => {
    const enPanne = etatDonnees[c.fichier] === 'erreur';
    const carte = el('button', { class: 'card' + (enPanne ? ' card--panne' : ''), type: 'button', 'data-edit': c.edit }, [
      el('span', { class: 'card-ico' }, [svgPicto(c.picto)]),
      el('span', { class: 'card-t', text: c.action }),
      el('span', { class: 'card-sub', text: enPanne ? 'Lecture impossible pour le moment' : c.sub })
    ]);
    const fl = el('span', { class: 'arrow' }); fl.innerHTML = SVG_FLECHE; carte.appendChild(fl);
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
    function ajouter(origine){
      const ta = champ('textarea', { rows: '3' }, origine ? origine.texte : '');
      const gras = interrupteur('En gras', origine ? origine.fort : false);
      const suppr = el('button', { type: 'button', class: 'ed-suppr', 'aria-label': 'Supprimer ce paragraphe', text: 'Supprimer' });
      const bloc = el('div', { class: 'ed-carte' }, [el('div', { class: 'ed-carte-h' }, [el('span', { class: 'ed-num' }), suppr]), groupe('Texte', ta), gras.noeud]);
      const ligne = { origine, ta, gras: gras.box, bloc };
      suppr.addEventListener('click', () => {
        if (lignes.length <= 1){ showToast('Il faut au moins un paragraphe.'); return; }
        lignes.splice(lignes.indexOf(ligne), 1); bloc.remove(); numeroter(); signalerSaisie();
      });
      lignes.push(ligne); zone.appendChild(bloc); numeroter();
      return ligne;
    }
    function numeroter(){ lignes.forEach((l, i) => { l.bloc.querySelector('.ed-num').textContent = 'Paragraphe ' + (i + 1); }); }
    (liste.length ? liste : [null]).forEach(ajouter);
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

  /* ── Adresses et téléphones : donnee.sites = [{cle, nom, adresse[], telephone}] ── */
  coordonnees(carte, donnee){
    const sites = Array.isArray(donnee && donnee.sites) ? donnee.sites : [];
    const zone = el('div', { class: 'ed-liste' });
    const lignes = sites.map(s => {
      const adr = Array.isArray(s.adresse) ? s.adresse : [];
      const champsAdr = [0, 1].concat(adr.slice(2).map((_, i) => i + 2)).map(i =>
        champ('input', { type: 'text', autocomplete: 'off' }, adr[i] || ''));
      const tel = champ('input', { type: 'tel', inputmode: 'tel', autocomplete: 'off' }, s.telephone || '');
      zone.appendChild(el('div', { class: 'ed-carte' }, [
        el('div', { class: 'ed-carte-h' }, [el('span', { class: 'ed-num', text: s.nom || s.cle })]),
        ...champsAdr.map((c, i) => groupe('Adresse — ligne ' + (i + 1), c)),
        groupe('Téléphone', tel, 'Format : 04 91 50 01 13 — il est mis à jour partout sur le site, lien d’appel compris.')
      ]));
      return { site: s, champsAdr, tel, adr };
    });
    return {
      noeud: zone,
      lire(){
        const out = lignes.map(({ site, champsAdr, tel, adr }) => {
          const nom = site.nom || site.cle;
          const inchangee = champsAdr.every(c => c.value === c.dataset.initial);
          const adresse = inchangee ? adr : champsAdr.map(c => c.value.trim()).filter(Boolean);
          if (!adresse.length) throw new Error('Adresse vide pour ' + nom + '.');
          const telephone = garde(tel, site.telephone);
          if (!telValide(telephone)) throw new Error('Téléphone de ' + nom + ' non reconnu. Exemple : 04 91 50 01 13');
          return { ...site, adresse, telephone };
        });
        return { ...(donnee || {}), sites: out };
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
      groupeLabel.hidden = groupeUrg.hidden = r.type === 'banniere';
      const e = etatMessage(r);
      apercu.textContent = 'Avec ces réglages : ' + e.val + ' — ' + e.sub;
      apercu.dataset.etat = e.val;
    }
    const noeud = el('div', { class: 'ed-liste' }, [
      el('div', { class: 'ed-carte' }, [actif.noeud, apercu]),
      el('div', { class: 'ed-carte' }, [el('div', { class: 'fld' }, [el('span', { class: 'fld-l', text: 'Partir d’un modèle' }), modeles]), format, groupeLabel,
        groupe('Titre', titre), groupe('Texte', texte, 'Mettez un passage **entre deux astérisques** pour l’écrire en gras.')]),
      el('div', { class: 'ed-carte' }, [el('div', { class: 'fld-duo' }, [groupe('Du', debut), groupe('Au (inclus)', fin)]),
        el('p', { class: 'fld-aide', text: 'Laissez vide pour commencer tout de suite / ne jamais s’arrêter. Le message s’éteint seul après la date de fin.' })]),
      el('div', { class: 'ed-carte' }, [groupeUrg])
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
  document.getElementById('editSub').textContent = carte.sub;
  const corps = document.getElementById('editCorps');
  corps.textContent = '';
  corps.appendChild(ed.noeud);
  majBoutonPublier();
  showScreen('edit');
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
  showScreen('dashboard');
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
  showScreen('dashboard');
  document.body.classList.remove('authed');
  showToast('Déconnecté');
}
function doLogout(){ siModifie(customLogout); }

/* ── Navigation ── */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-screen]');
  if (b) siModifie(() => { edition = null; showScreen(b.dataset.screen); });
});
document.addEventListener('input', e => { if (e.target.closest('#editCorps')) signalerSaisie(); });
document.addEventListener('change', e => { if (e.target.closest('#editCorps')) signalerSaisie(); });
