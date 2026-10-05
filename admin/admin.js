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
  document.querySelectorAll('[data-screen]').forEach(b => {
    if (b.classList.contains('nav-item') || b.classList.contains('nb-item')) b.classList.toggle('active', b.dataset.screen === nom);
  });
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

/* Les éditeurs arrivent à l'étape suivante : coquille en lecture seule. */
function openEdit(carte){
  showToast('L\'édition « ' + carte.label + ' » arrive bientôt.');
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
  showScreen('dashboard');
  document.body.classList.remove('authed');
  showToast('Déconnecté');
}
function doLogout(){ customLogout(); }

/* ── Navigation ── */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-screen]');
  if (b) showScreen(b.dataset.screen);
});
