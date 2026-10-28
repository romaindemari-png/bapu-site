/* ============================================================
   B4 — PUBLIER JUSQU'AU BOUT (LELAB-DESIGN §6 ; reprise du bout 6 de bistrot-sassy)
   Usage :  python3 -m http.server <port>   (à la racine du dépôt)
            node scripts/test-publier.js [http://localhost:<port>]

   save-data ET le fichier public (/_data/<fichier>.json?t=…, la relecture) sont INTERCEPTÉS : la
   sonde décide quand le « déploiement » a eu lieu. Les données servies au chargement sont les COPIES
   GELÉES de scripts/fixtures/. Rien n'est écrit, nulle part.
   HORLOGE : window.__LELAB_TEMPS = K (0,02) : courbe 40 s → 0,8 s, relecture 3 s → 60 ms, délai max
   120 s → 2,4 s. Sans la variable, les durées sont les nominales (cas 0).

   0. Durées nominales sans la variable : 40 000 / 3 000 / 120 000 ms.
   1. REPOS : « Tout est en ligne » en contour, inactif ; la phrase d'aide dessous.
   2. MODIFIÉ : « Publier » à voir ; dessous « 1 changement · Annuler » (2 changements, au pluriel) ;
      le bouton NE BOUGE PAS entre les deux états.
   3. ANNULER : l'éditeur revient à ce qui est en ligne, le bouton au repos.
   A. 2 relectures périmées puis 1 bonne → « ✓ C'est en ligne » APRÈS la 3e, jamais avant ; le
      remplissage ne dépasse jamais 85 % sans preuve ; repos 3 s après. L'éditeur RESTE ouvert
      (plus de fermeture automatique à 1,2 s). Aucune phrase « moins d'une minute ».
   B. Le fichier public ne change jamais → au délai max : « Envoyé » + phrase du délai long ;
      JAMAIS « en ligne ».
   C. save-data 500 → retour à « Publier », saisie intacte, phrase d'échec, AUCUNE relecture.
   D. prefers-reduced-motion → aucun remplissage, mêmes textes, « ✓ C'est en ligne » à la preuve.
   E. On revient à « Mon site » pendant la mise en ligne → la relecture continue ; la phrase d'accueil
      dit « Une publication est en cours. » et le bouton de l'accueil « Envoyé · mise en ligne… »,
      jusqu'à la preuve, puis « ✓ C'est en ligne » et le repos.
   ============================================================ */
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIX = f => fs.readFileSync(path.join(__dirname, 'fixtures', f + '.json'), 'utf8');
const K = 0.02, INTERVALLE = 3000 * K, DELAI_MAX = 120000 * K, SAVE_MS = 300, REPOS_MS = 3000;
const pause = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0, total = 0;
function ok(nom, cond, detail){ total++; if (!cond) echecs++; console.log((cond ? '✓ ' : '✗ ') + nom + (cond || detail === undefined ? '' : '\n    → ' + detail)); }

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });

  /* publicBon(n) : la n-ième relecture (après l'envoi) rend-elle ce qui a été envoyé ? */
  async function ouvrir({ publicBon = () => true, saveStatus = 200, reduit = false, echelle = K } = {}){
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
    if (reduit) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (echelle != null) await p.evaluateOnNewDocument(k => { window.__LELAB_TEMPS = k; }, echelle);
    const j = { envoi: null, relectures: 0, relecturesApresEchec: 0, echec: false };
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url());
      if (u.pathname === '/.netlify/functions/save-data'){
        j.envoi = JSON.parse(r.postData() || '{}');
        return setTimeout(() => { if (saveStatus !== 200) j.echec = true;
          r.respond({ status: saveStatus, contentType: 'application/json', body: saveStatus === 200 ? '{"success":true}' : '{"error":"sonde : 500"}' }); }, SAVE_MS);
      }
      const m = u.pathname.match(/^\/_data\/([a-z0-9-]+)\.json$/);
      if (!m) return r.continue();
      if (u.search && j.envoi && j.envoi.section && m[1] === 'coordonnees'){   // la relecture du fichier public
        j.relectures++; if (j.echec) j.relecturesApresEchec++;
        const corps = publicBon(j.relectures) ? JSON.stringify(j.envoi.data, null, 2) + '\n' : FIX(m[1]);
        return r.respond({ status: 200, contentType: 'application/json', body: corps });
      }
      const f = path.join(__dirname, 'fixtures', m[1] + '.json');
      return fs.existsSync(f) ? r.respond({ status: 200, contentType: 'application/json', body: fs.readFileSync(f, 'utf8') }) : r.respond({ status: 404, body: '' });
    });
    p.on('pageerror', e => ok('aucune erreur JS', false, e.message));
    await p.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => document.body.classList.contains('authed') && document.querySelectorAll('#siteCards .card').length > 0, { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => { session = { access_token: 'test', refresh_token: 'test', expires_at: Date.now() + 3600e3 }; });
    return { p, j, ctx };
  }
  const ouvrirAdresses = p => p.evaluate(() => openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees')));
  const saisirTel = (p, i, v) => p.evaluate((i, v) => { const n = document.querySelectorAll('#editCorps input[type=tel]')[i]; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, i, v);
  const lire = (p, ids = ['btnPublier', 'publierLigne']) => p.evaluate(ids => {
    const btn = document.getElementById(ids[0]), l = document.getElementById(ids[1]);
    const vis = e => e && e.getClientRects().length > 0 && !e.hidden;
    const r = btn && btn.getBoundingClientRect();
    return { txt: btn ? (btn.querySelector('.pub-txt') || btn).textContent.trim() : null, cls: btn ? btn.className : '', actif: btn ? !btn.disabled : false,
             f: btn && btn.dataset.remplissage ? +btn.dataset.remplissage : 0, remplit: btn ? btn.classList.contains('remplit') : false,
             ligne: l ? [...l.children].filter(vis).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ').trim() || l.textContent.trim() : null,
             haut: r ? Math.round(r.top) : null, bas: r ? Math.round(r.bottom) : null,
             edition: document.getElementById('screen-edit').classList.contains('active'),
             page: document.body.innerText };
  }, ids);
  /* Suit le bouton jusqu'à une condition, en notant le plus fort remplissage vu sans « en ligne ». */
  /* avantPreuve() : la preuve n'a pas encore été servie (le dernier centimètre, après elle, ne compte pas). */
  async function suivre(p, jusqua, delai, ids, avantPreuve = () => true){
    const t0 = Date.now(); let maxSansPreuve = 0, vuMoinsDUne = false, etats = [];
    while (Date.now() - t0 < delai){
      const e = await lire(p, ids);
      if (avantPreuve() && !/C.est en ligne/.test(e.txt)) maxSansPreuve = Math.max(maxSansPreuve, e.f);   // « mise en ligne… » n'est pas une preuve
      if (/moins d.une minute/.test(e.page)) vuMoinsDUne = true;
      if (!etats.length || etats[etats.length - 1] !== e.txt) etats.push(e.txt);
      if (jusqua(e)) return { e, maxSansPreuve, vuMoinsDUne, etats, ms: Date.now() - t0 };
      await pause(15);
    }
    return { e: await lire(p, ids), maxSansPreuve, vuMoinsDUne, etats, ms: Date.now() - t0, delai: true };
  }

  /* 0. Durées nominales */
  {
    const { p, ctx } = await ouvrir({ echelle: null });
    const d = await p.evaluate(() => typeof dureesPublier === 'function' ? dureesPublier() : null);
    ok('0 · sans __LELAB_TEMPS : durées nominales 40 000 / 3 000 / 120 000 ms', d && d.courbe === 40000 && d.intervalle === 3000 && d.delaiMax === 120000, JSON.stringify(d));
    await ctx.close();
  }

  /* 1–3. Repos, modifié, pluriel, le bouton ne bouge pas, Annuler */
  {
    const { p, ctx } = await ouvrir();
    await ouvrirAdresses(p);
    const r0 = await lire(p);
    ok('1 · repos : « Tout est en ligne », contour, inactif', r0.txt === 'Tout est en ligne' && /pub--repos/.test(r0.cls) && !r0.actif, JSON.stringify([r0.txt, r0.cls, r0.actif]));
    ok('1 · repos : la phrase d’aide sous le bouton', r0.ligne === 'Modifiez un champ et le bouton s’allume.', r0.ligne);
    await saisirTel(p, 1, '06 12 34 56 78');
    const r1 = await lire(p);
    ok('2 · modifié : « Publier », à voir, actif', r1.txt === 'Publier' && /pub--a-voir/.test(r1.cls) && r1.actif, JSON.stringify([r1.txt, r1.cls, r1.actif]));
    ok('2 · modifié : « 1 changement · Annuler »', r1.ligne === '1 changement · Annuler', r1.ligne);
    ok('2 · le bouton ne bouge pas (repos → modifié)', r0.haut === r1.haut && r0.bas === r1.bas, JSON.stringify([r0.haut, r0.bas, r1.haut, r1.bas]));
    await saisirTel(p, 0, '04 00 00 00 00');
    const r2 = await lire(p);
    ok('2 · deux champs modifiés : « 2 changements · Annuler »', r2.ligne === '2 changements · Annuler', r2.ligne);
    await p.evaluate(() => { const a = document.querySelector('#publierLigne .pub-annuler'); if (a) a.click(); });
    const r3 = await lire(p);
    const tel = await p.evaluate(() => [...document.querySelectorAll('#editCorps input[type=tel]')].map(i => i.value));
    const orig = JSON.parse(FIX('coordonnees')).telephones;
    ok('3 · Annuler : les champs reviennent à ce qui est en ligne, le bouton au repos',
      tel[0] === orig.standard && tel[1] === orig.portable && r3.txt === 'Tout est en ligne' && r3.edition, JSON.stringify([tel, r3.txt]));
    await ctx.close();
  }

  /* A. Deux relectures périmées, puis la bonne */
  for (const reduit of [false, true]){
    const cas = reduit ? 'D' : 'A';
    const { p, j, ctx } = await ouvrir({ publicBon: n => n >= 3, reduit });
    await ouvrirAdresses(p); await saisirTel(p, 1, '06 12 34 56 78');
    await p.evaluate(() => { publier(); });   // sans attendre l'envoi : « Publication… » doit se voir
    const s = await suivre(p, e => /C.est en ligne/.test(e.txt), 8000, undefined, () => j.relectures < 3);
    ok(`${cas} · « ✓ C’est en ligne » après la 3e relecture, jamais avant`, /C.est en ligne/.test(s.e.txt) && j.relectures === 3, JSON.stringify({ relectures: j.relectures, etats: s.etats }));
    ok(`${cas} · états vus : Publication…, Envoyé · mise en ligne…, ✓ C’est en ligne`,
      ['Publication…', 'Envoyé · mise en ligne…', '✓ C’est en ligne'].every(t => s.etats.includes(t)), JSON.stringify(s.etats));
    ok(`${cas} · le jaune « en ligne » : classe pub--confirme`, /pub--confirme/.test(s.e.cls), s.e.cls);
    if (!reduit) ok('A · remplissage jamais ≥ 85 % sans preuve', s.maxSansPreuve > 0 && s.maxSansPreuve < 0.85, String(s.maxSansPreuve));
    else ok('D · mouvement réduit : aucun remplissage', s.maxSansPreuve === 0 && !s.e.remplit, JSON.stringify([s.maxSansPreuve, s.e.remplit]));
    ok(`${cas} · l’éditeur reste ouvert (plus de fermeture à 1,2 s)`, s.e.edition);
    ok(`${cas} · aucune phrase « moins d’une minute »`, !s.vuMoinsDUne);
    const s2 = await suivre(p, e => e.txt === 'Tout est en ligne', REPOS_MS + 2000);
    ok(`${cas} · repos 3 s après : « Tout est en ligne », phrase d’aide`, s2.e.txt === 'Tout est en ligne' && s2.e.ligne === 'Modifiez un champ et le bouton s’allume.' && s2.ms > REPOS_MS - 800, JSON.stringify([s2.e.txt, s2.e.ligne, s2.ms]));
    const champ = await p.evaluate(() => (document.querySelectorAll('#editCorps input[type=tel]')[1] || {}).value);
    ok(`${cas} · l’éditeur repart de ce qui est en ligne (le nouveau numéro, sans changement en attente)`, champ === '06 12 34 56 78' && !s2.e.actif, JSON.stringify([champ, s2.e.actif]));
    await ctx.close();
  }

  /* B. Le fichier public ne change jamais */
  {
    const { p, j, ctx } = await ouvrir({ publicBon: () => false });
    await ouvrirAdresses(p); await saisirTel(p, 1, '06 12 34 56 78');
    await p.evaluate(() => { publier(); });   // sans attendre l'envoi : « Publication… » doit se voir
    const s = await suivre(p, e => e.txt === 'Envoyé' , DELAI_MAX + 3000);
    ok('B · au délai max : « Envoyé »', s.e.txt === 'Envoyé' && j.relectures >= Math.floor(DELAI_MAX / INTERVALLE / 2) /* une relecture toutes les ~3 s, plus le temps de la requête */, JSON.stringify({ txt: s.e.txt, relectures: j.relectures }));
    ok('B · phrase du délai long', s.e.ligne === 'Envoyé. La mise en ligne prend plus de temps que d’habitude, elle se fera seule.', s.e.ligne);
    ok('B · jamais « en ligne »', !s.etats.some(t => /C.est en ligne/.test(t)), JSON.stringify(s.etats));
    await ctx.close();
  }

  /* C. save-data répond 500 */
  {
    const { p, j, ctx } = await ouvrir({ saveStatus: 500 });
    await ouvrirAdresses(p); await saisirTel(p, 1, '06 12 34 56 78');
    await p.evaluate(() => { publier(); });   // sans attendre l'envoi : « Publication… » doit se voir
    const s = await suivre(p, e => e.txt === 'Publier' && e.actif, 4000);
    await pause(INTERVALLE * 4);
    const champ = await p.evaluate(() => (document.querySelectorAll('#editCorps input[type=tel]')[1] || {}).value);
    ok('C · retour à « Publier », actif, saisie intacte', s.e.txt === 'Publier' && s.e.actif && champ === '06 12 34 56 78', JSON.stringify([s.e.txt, s.e.actif, champ]));
    ok('C · phrase d’échec', s.e.ligne === 'Ça n’est pas parti. Vos changements sont gardés, réessayez.', s.e.ligne);
    ok('C · aucune relecture du fichier public', j.relectures === 0, String(j.relectures));
    await ctx.close();
  }

  /* E. Retour à « Mon site » pendant la mise en ligne */
  {
    const { p, j, ctx } = await ouvrir({ publicBon: n => n >= 6 });
    await ouvrirAdresses(p); await saisirTel(p, 1, '06 12 34 56 78');
    await p.evaluate(() => { publier(); });   // sans attendre l'envoi : « Publication… » doit se voir
    await suivre(p, e => e.txt === 'Envoyé · mise en ligne…', 3000);
    await p.evaluate(() => { const r = document.querySelector('#screen-edit.active .retour'); if (r) r.click(); });
    const accueil = ['btnAccueil', 'accueilLigne'];
    const a0 = await lire(p, accueil);
    const phrase0 = await p.evaluate(() => document.getElementById('accueilEtat').textContent.trim());
    ok('E · sur Mon site : « Une publication est en cours. »', phrase0 === 'Une publication est en cours.' && !a0.edition, JSON.stringify([phrase0, a0.edition]));
    ok('E · le bouton de l’accueil : « Envoyé · mise en ligne… »', a0.txt === 'Envoyé · mise en ligne…', a0.txt);
    const s = await suivre(p, e => /C.est en ligne/.test(e.txt), 8000, accueil);
    ok('E · la relecture continue hors de l’éditeur : « ✓ C’est en ligne » à la preuve', /C.est en ligne/.test(s.e.txt) && j.relectures >= 6, JSON.stringify({ txt: s.e.txt, relectures: j.relectures }));
    const phrase1 = await p.evaluate(() => document.getElementById('accueilEtat').textContent.trim());
    ok('E · après la preuve, la phrase d’accueil redit l’état du site', phrase1 !== 'Une publication est en cours.', phrase1);
    const s2 = await suivre(p, e => e.txt === 'Tout est en ligne', REPOS_MS + 2000, accueil);
    ok('E · accueil au repos 3 s après', s2.e.txt === 'Tout est en ligne' && s2.e.ligne === 'Ouvrez une carte pour la modifier.', JSON.stringify([s2.e.txt, s2.e.ligne]));
    await ctx.close();
  }

  await b.close();
  console.log(`\n${total - echecs}/${total} vérifications passées`);
  process.exit(echecs ? 1 : 0);
})();
