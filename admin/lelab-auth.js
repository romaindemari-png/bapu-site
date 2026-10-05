/* ============================================================
   LeLab — CŒUR AUTH + LECTURE (Netlify Identity / GoTrue)
   ------------------------------------------------------------
   PROVENANCE : copie À L'OCTET de
     dépôt   romaindemari-png/lestud-template-food
     fichier admin/index.html
     commit  5573d2d
     lignes  2409–2549, 2569–2591, 2690–2769, 2773–2800
   Chaque bloc est encadré par « @@ master … » / « @@ fin … ».
   NE RIEN MODIFIER entre ces marqueurs : un correctif se fait AU MASTER,
   puis redescend ici (nouveau commit → nouveaux numéros de ligne).
   Contrôle : sh scripts/verif-lelab-auth.sh

   CE QUE CE CŒUR ATTEND DE L'ADMIN QUI L'ACCUEILLE :
     fonctions  boot(user)  showToast(msg)
     DOM        #login-gate (h1, p)  #login-form #login-email #login-password
                #login-submit #login-error  #setpw-form #setpw-password
                #setpw-confirm #setpw-submit #setpw-error
     CSS        body.authed (porte ouverte) · body.dev-local (bypass)
   Le démarrage (handleAuthHash → restoreSession au DOMContentLoaded)
   est fait par l'admin, comme dans le master.
   ============================================================ */


/* @@ master admin/index.html L2409-2549 @5573d2d — session, connexion, jeton (refresh sérialisé), authedFetch */
/* ════ AUTH CUSTOM (API GoTrue — remplace le widget) ════ */
const IDENTITY = '/.netlify/identity';
const SESSION_KEY = 'lelab_session';
let session = null;   // { access_token, refresh_token, expires_at, user }

function saveSession(s){ session = s; try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch(e){} }
function clearSession(){ session = null; try { localStorage.removeItem(SESSION_KEY); } catch(e){} }

async function fetchIdentityUser(){
  const res = await fetch(IDENTITY + '/user', { headers: { Authorization: 'Bearer ' + session.access_token } });
  if (!res.ok) throw new Error('Profil indisponible');
  return res.json();
}

// Connexion (password grant)
async function customLogin(event){
  if (event) event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-password').value;
  const err   = document.getElementById('login-error');
  const btn   = document.getElementById('login-submit');
  err.textContent = '';
  if (!email || !pwd){ err.textContent = 'Email et mot de passe requis.'; return false; }
  const lbl = btn.textContent; btn.disabled = true; btn.textContent = '⏳ Connexion…';
  try {
    const res = await fetch(IDENTITY + '/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', username: email, password: pwd })
    });
    const data = await res.json();
    if (!res.ok || !data.access_token){
      err.textContent = (data.error === 'invalid_grant') ? 'Email ou mot de passe incorrect.' : (data.error_description || 'Connexion impossible.');
      document.getElementById('login-password').value = '';
      return false;
    }
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000)
    });
    const user = await fetchIdentityUser();
    saveSession({ ...session, user });
    boot(user);
  } catch (e){
    err.textContent = 'Connexion impossible — réessaie.';
  } finally {
    btn.disabled = false; btn.textContent = lbl;
  }
  return false;
}

const TOKEN_BUFFER_MS = 120000;   // refresh anticipé (absorbe un décalage d'horloge desktop/serveur)
let refreshPromise = null;        // refresh en vol partagé → ne dépense jamais 2× le refresh token (usage unique GoTrue)

function readStoredSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e){ return null; }
}
function failRefresh(){
  clearSession();
  document.body.classList.remove('authed');
  showToast('⚠️ Session expirée — reconnecte-toi');
  return null;
}

// Renvoie un access_token valide. Réconcilie avec localStorage (multi-onglets / appels concurrents),
// puis rafraîchit de façon sérialisée si expiré (avec buffer).
async function getToken(){
  if (!session) return null;
  // adopter un token plus frais déposé par un autre onglet / appel
  const stored = readStoredSession();
  if (stored && stored.access_token && (stored.expires_at || 0) > (session.expires_at || 0)){
    session = { ...session, ...stored };
  }
  if (Date.now() <= session.expires_at - TOKEN_BUFFER_MS) return session.access_token;
  return refreshToken(false);
}

// Force un refresh, même si le token paraît encore valide côté client (utilisé sur 401 serveur).
function forceRefresh(){ return refreshToken(true); }

// Refresh SÉRIALISÉ : un seul appel /token concurrent, partagé par tous les appelants.
function refreshToken(force){
  if (!refreshPromise) refreshPromise = doRefresh(force).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function doRefresh(force){
  // un autre onglet/appel a peut-être déjà rafraîchi → l'adopter plutôt que brûler notre refresh token
  const fresh = readStoredSession();
  if (!force && fresh && fresh.access_token && Date.now() <= (fresh.expires_at || 0) - TOKEN_BUFFER_MS){
    session = { ...session, ...fresh };
    return session.access_token;
  }
  const rt = (session && session.refresh_token) || (fresh && fresh.refresh_token);
  if (!rt) return failRefresh();
  let res, data;
  try {
    res = await fetch(IDENTITY + '/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt })
    });
    data = await res.json().catch(() => ({}));
  } catch (e){
    return (session && session.access_token) || null;   // réseau KO : ne pas détruire la session
  }
  if (!res.ok || !data.access_token){
    // dernier recours : un autre onglet a peut-être posé un token frais entre-temps
    const again = readStoredSession();
    if (again && again.access_token && Date.now() <= (again.expires_at || 0) - TOKEN_BUFFER_MS){
      session = { ...session, ...again };
      return session.access_token;
    }
    return failRefresh();
  }
  saveSession({
    ...session,
    access_token: data.access_token,
    refresh_token: data.refresh_token || session.refresh_token,
    expires_at: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000)
  });
  return session.access_token;
}

// POST JSON authentifié, avec retry UNIQUE sur 401 (token rejeté côté serveur → refresh forcé + 1 retry).
async function authedFetch(url, payload){
  const token = await getToken();
  if (!token) throw new Error('Non connecté');
  const call = (t) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
    body: JSON.stringify(payload)
  });
  let res = await call(token);
  if (res.status === 401){
    const t2 = await forceRefresh();
    if (t2) res = await call(t2);
  }
  return res;
}
/* @@ fin L2409-2549 */


/* @@ master admin/index.html L2569-2591 @5573d2d — bypass localhost + restauration de session au chargement */
/* ── BYPASS DEV — localhost UNIQUEMENT ────────────────────────────────────────────────────────
   Netlify Identity ne tourne pas en local et l'admin est gaté par elle (body:not(.authed) .app
   {display:none}). Sur localhost on entre DIRECT, en session factice, pour VOIR l'UI avant de
   déployer. JAMAIS en prod : le hostname de prod n'est pas localhost/127.0.0.1. Les fonctions
   serveur restent protégées (elles valident un vrai token GoTrue) → save/publish échouent en
   local, c'est ATTENDU ; loadSassyData lit les JSON statiques, donc le rendu est fidèle. Voir DEV.md. */
const DEV_LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !window.__NO_DEV_BYPASS;   // opt-out : les garde-fous contrôlent le boot eux-mêmes

// Au chargement : restaure la session (avec refresh) ou affiche le login
async function restoreSession(){
  if (DEV_LOCAL){ document.body.classList.add('dev-local'); boot({ dev: true }); return; }   // bypass dev (localhost) — cf. ci-dessus
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e){}
  if (s && s.access_token){
    session = s;
    const t = await getToken();           // refresh si nécessaire
    if (t){
      try { const user = await fetchIdentityUser(); saveSession({ ...session, user }); boot(user); return; }
      catch(e){ clearSession(); }
    }
  }
  document.body.classList.remove('authed'); // → login gate visible
}
/* @@ fin L2569-2591 */


/* @@ master admin/index.html L2690-2769 @5573d2d — liens d'invitation / récupération → définir le mot de passe */
/* ── Liens d'invitation / récupération (fragment #invite_token / #recovery_token) ──
   L'auth custom (sans widget) doit intercepter ces tokens : sinon le lien reçu par mail
   affiche la porte de login normale et le compte reste inactivable. */
let pendingAuth = null;   // { type:'invite'|'recovery', token }

function handleAuthHash(){
  const h = (location.hash || '').replace(/^#/, '');
  if (!h) return false;
  const p = new URLSearchParams(h);
  const invite = p.get('invite_token');
  const recovery = p.get('recovery_token');
  if (!invite && !recovery) return false;
  pendingAuth = invite ? { type:'invite', token:invite } : { type:'recovery', token:recovery };
  // retirer le token de l'URL (ni historique ni onglet ne le conservent), sans recharger
  try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
  const gate = document.getElementById('login-gate');
  gate.querySelector('h1').textContent = invite ? 'Activez votre compte' : 'Nouveau mot de passe';
  gate.querySelector('p').textContent  = invite
    ? 'Choisissez votre mot de passe pour accéder à votre espace.'
    : 'Choisissez un nouveau mot de passe pour votre compte.';
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('setpw-form').style.display = 'flex';
  document.body.classList.remove('authed');   // s'assurer que la porte est visible
  return true;
}

async function submitNewPassword(event){
  if (event) event.preventDefault();
  const pw  = document.getElementById('setpw-password').value;
  const pw2 = document.getElementById('setpw-confirm').value;
  const err = document.getElementById('setpw-error');
  const btn = document.getElementById('setpw-submit');
  err.textContent = '';
  if (!pendingAuth){ err.textContent = 'Lien invalide — recommencez depuis le mail.'; return false; }
  if (pw.length < 10){ err.textContent = 'Mot de passe trop court : 10 caractères minimum.'; return false; }
  if (pw !== pw2){ err.textContent = 'Les deux mots de passe ne correspondent pas.'; return false; }
  const lbl = btn.textContent; btn.disabled = true; btn.textContent = '⏳ Activation…';
  try {
    let data;
    if (pendingAuth.type === 'invite'){
      // signup : pose le mot de passe ET ouvre la session
      const res = await fetch(IDENTITY + '/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type:'signup', token: pendingAuth.token, password: pw })
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) throw new Error(data.msg || data.error_description || 'Lien expiré ou déjà utilisé.');
    } else {
      // recovery : 1) échange le token contre une session, 2) met à jour le mot de passe
      const res = await fetch(IDENTITY + '/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type:'recovery', token: pendingAuth.token })
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) throw new Error(data.msg || data.error_description || 'Lien expiré ou déjà utilisé.');
      const upd = await fetch(IDENTITY + '/user', {
        method: 'PUT', headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + data.access_token },
        body: JSON.stringify({ password: pw })
      });
      if (!upd.ok) throw new Error('Impossible de définir le mot de passe.');
    }
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000)
    });
    const user = await fetchIdentityUser();
    saveSession({ ...session, user });
    pendingAuth = null;
    // remet la porte en mode login pour les usages suivants
    document.getElementById('setpw-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'flex';
    boot(user);
  } catch(e){
    err.textContent = e.message || 'Activation impossible — réessayez.';
  } finally {
    btn.disabled = false; btn.textContent = lbl;
  }
  return false;
}
/* @@ fin L2690-2769 */


/* @@ master admin/index.html L2773-2800 @5573d2d — lecture des _data/*.json à trois états (ok / absent / erreur) */

/* ⚠️ UNE DONNÉE QUI N'A PAS CHARGÉ NE DOIT JAMAIS DEVENIR UNE DONNÉE ÉCRASÉE.
   Ce chargeur avalait TOUTE erreur et rendait `null` — 404, 500, CDN froid, JSON malformé : le même
   silence. `prefillSection` est gardé (`&& horaires && horaires.jours`) : il ne remplissait donc
   rien, LE GABARIT STATIQUE RESTAIT À L'ÉCRAN — et celui des horaires porte des heures FACTICES
   écrites en dur. `saveSection` publiait ce gabarit. Le client publiait des horaires qui n'étaient
   pas les siens, sans un seul moyen de le savoir.
   C'est la famille des deux fichiers vidés chez Georges : une garde d'AFFICHAGE qui laisse passer
   une ÉCRITURE. `saveBlocs()` avait déjà le bon réflexe (« Configuration indisponible — publication
   annulée ») ; il n'était appliqué nulle part ailleurs.

   ⚠️ ET IL FAUT TROIS ÉTATS, PAS DEUX — sinon on casse la CRÉATION :
     · 'ok'      lu ET analysé                                → publication autorisée
     · 'absent'  404, le fichier n'existe pas encore           → publication autorisée : c'est une
                 création, exactement ce que save-data traite déjà en repartant sans sha
     · 'erreur'  tout le reste (5xx, réseau, corps illisible)  → PUBLICATION REFUSÉE
   Un bloc que le client vient d'activer n'a pas encore son `_data/<clé>.json` : confondre son
   absence avec une panne de lecture l'empêcherait d'écrire sa première ligne. */
const etatDonnees = {};   // clé de fichier ('carte', 'horaires', 'general'…) → 'ok' | 'absent' | 'erreur'
const _json = (f) => fetch('/_data/' + f + '.json')
  .then(r => {
    if (!r.ok){ etatDonnees[f] = (r.status === 404) ? 'absent' : 'erreur'; return null; }
    return r.json().then(
      j  => { etatDonnees[f] = 'ok';     return j; },
      () => { etatDonnees[f] = 'erreur'; return null; }   // 200 mais corps illisible : c'est une panne
    );
  })
  .catch(() => { etatDonnees[f] = 'erreur'; return null; });   // réseau coupé, DNS, CORS
/* @@ fin L2773-2800 */
