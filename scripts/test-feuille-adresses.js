/* ============================================================
   B5 — LA FEUILLE « ADRESSES & TÉLÉPHONES » (LELAB-DESIGN §4 : la feuille ; schéma réel de coordonnees.json)
   Usage :  python3 -m http.server <port>   (à la racine du dépôt)
            node scripts/test-feuille-adresses.js [http://localhost:<port>]

   Des GESTES DE CLIENT (clic, sélection, frappe), pas des appels de fonction. coordonnees.json servi
   = COPIE GELÉE (scripts/fixtures/coordonnees.json) ; save-data INTERCEPTÉ, rien n'est écrit.

   1. LA FEUILLE : les vraies valeurs, posées comme sur le site (Standard, Portable, Marseille, Aix),
      sans libellé technique (« adresse, ligne 1 », « **gras** ») ni « le plan suit l'adresse » ;
      la carte Google est dite telle qu'elle est : elle ne suit pas.
   2. GESTES → JSON : le JSON envoyé est EXACTEMENT scripts/fixtures/adresses-attendu.json, ÉCRIT À LA
      MAIN, après : portable retapé (avec des espaces autour), Aix 1re ligne modifiée, Marseille 2e
      ligne modifiée puis remise à l'identique. Le bouton annonce « 2 changements » avant l'envoi.
   3. ALLER-RETOUR : publier sans rien changer réécrit le fichier à l'octet ; une clé inconnue survit.
   4. NUMÉRO INVALIDE : la ligne est marquée, le message le dit, « Publier » est inactif, rien ne part.
   5. LE SITE : le JSON envoyé, servi au site public, met le nouveau portable aux CINQ endroits (menu,
      haut de page, rendez-vous, infos, pied de page), lien d'appel compris ; la nouvelle adresse d'Aix
      dans « Adresses. » et dans le pied de page.
   ============================================================ */
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIX = f => fs.readFileSync(path.join(__dirname, 'fixtures', f + '.json'), 'utf8');
const commeSaveData = d => JSON.stringify(d, null, 2) + '\n';

let echecs = 0, total = 0;
function ok(nom, cond, detail){ total++; if (!cond) echecs++; console.log((cond ? '✓ ' : '✗ ') + nom + (cond || detail === undefined ? '' : '\n    → ' + detail)); }

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  async function ouvrir(coordonnees){
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
    const envois = [];
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url());
      if (u.pathname === '/.netlify/functions/save-data'){ envois.push(JSON.parse(r.postData())); return r.respond({ status: 200, contentType: 'application/json', body: '{"success":true}' }); }
      const m = u.pathname.match(/^\/_data\/([a-z0-9-]+)\.json$/);
      if (!m) return r.continue();
      if (m[1] === 'coordonnees' && coordonnees) return r.respond({ status: 200, contentType: 'application/json', body: coordonnees });
      const f = path.join(__dirname, 'fixtures', m[1] + '.json');
      return fs.existsSync(f) ? r.respond({ status: 200, contentType: 'application/json', body: fs.readFileSync(f, 'utf8') }) : r.respond({ status: 404, body: '' });
    });
    p.on('pageerror', e => ok('aucune erreur JS', false, e.message));
    await p.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => document.body.classList.contains('authed') && document.querySelectorAll('#siteCards .card').length > 0, { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => { session = { access_token: 'test', refresh_token: 'test', expires_at: Date.now() + 3600e3 }; });
    await p.click('#siteCards .card[data-edit="coordonnees"]');
    await p.waitForSelector('#screen-edit.active');
    return { p, envois };
  }
  /* Taper comme un client : cliquer dans le champ, tout sélectionner, taper. */
  async function retaper(p, champ, texte){
    const el = await p.$(champ);
    if (!el){ ok('champ présent : ' + champ, false); return; }
    await el.click({ clickCount: 3 });
    await p.keyboard.down('Meta'); await p.keyboard.press('KeyA'); await p.keyboard.up('Meta');
    await p.keyboard.press('Backspace');
    await p.keyboard.type(texte);
  }
  const ligne = () => p0 => p0.evaluate(() => (document.getElementById('publierLigne') || {}).innerText);

  /* 1. LA FEUILLE */
  {
    const { p } = await ouvrir();
    const r = await p.evaluate(() => {
      const f = document.querySelector('#editCorps .feuille');
      const vis = e => e && e.getClientRects().length > 0;
      return {
        feuille: vis(f), grain: !!f && f.classList.contains('grain-papier'),
        valeurs: f ? [...f.querySelectorAll('.f-champ')].map(i => i.value) : [],
        groupes: f ? [...f.querySelectorAll('.f-titre')].map(h => h.textContent.trim()) : [],
        libs: f ? [...f.querySelectorAll('.f-lib')].filter(vis).map(l => l.textContent.trim()) : [],
        texte: document.getElementById('screen-edit').innerText,
        titre: document.getElementById('editTitre').textContent.trim(),
        sur: (document.getElementById('editSur') || {}).textContent,
      };
    });
    const c = JSON.parse(FIX('coordonnees'));
    const attendues = [c.telephones.standard, c.telephones.portable, ...c.sites[0].adresse, ...c.sites[1].adresse];
    ok('feuille : papier grainé, visible', r.feuille && r.grain, JSON.stringify([r.feuille, r.grain]));
    ok('feuille : les vraies valeurs, dans l’ordre (standard, portable, Marseille, Aix)', JSON.stringify(r.valeurs) === JSON.stringify(attendues), JSON.stringify(r.valeurs));
    ok('feuille : groupes « Téléphones », « Marseille », « Aix-en-Provence »', JSON.stringify(r.groupes) === '["Téléphones","Marseille","Aix-en-Provence"]', JSON.stringify(r.groupes));
    ok('feuille : libellés de numéros « Standard », « Portable »', JSON.stringify(r.libs) === '["Standard","Portable"]', JSON.stringify(r.libs));
    ok('titre « Adresses & téléphones », surtitre « 02 · … » (où ça se voit)', r.titre === 'Adresses & téléphones' && /^02 · /.test(r.sur || ''), JSON.stringify([r.titre, r.sur]));
    ok('aucun libellé technique (« adresse, ligne », « ** »)', !/adresse, ligne|\*\*/i.test(r.texte), r.texte.match(/.{0,30}(adresse, ligne|\*\*).{0,30}/i));
    ok('pas de « le plan suit l’adresse » ; la carte Google est dite telle qu’elle est', !/plan suit/i.test(r.texte) && /carte Google ne suit pas/i.test(r.texte), r.texte.match(/.{0,40}carte.{0,60}/i));
    await p.close();
  }

  /* 2. GESTES → JSON écrit à la main */
  {
    const { p, envois } = await ouvrir();
    await retaper(p, '#editCorps .f-champ[data-champ="portable"]', '  06 12 34 56 78 ');
    await retaper(p, '#editCorps .f-champ[data-site="aix"][data-ligne="0"]', 'Cité U des Gazelles — Pavillon 8,');
    await retaper(p, '#editCorps .f-champ[data-site="marseille"][data-ligne="1"]', '13004 Marseille, autre');
    await retaper(p, '#editCorps .f-champ[data-site="marseille"][data-ligne="1"]', '13004 Marseille');
    const l = await ligne()(p);
    ok('gestes : « 2 changements · Annuler » avant l’envoi', /^2 changements · Annuler$/.test((l || '').replace(/\s+/g, ' ').trim()), l);
    const actif = await p.evaluate(() => document.querySelector('#editCorps .f-ligne:focus-within') && getComputedStyle(document.querySelector('#editCorps .f-ligne:focus-within')).backgroundColor);
    ok('gestes : la ligne en cours est surlignée', actif && actif !== 'rgba(0, 0, 0, 0)', actif);
    await p.click('#btnPublier');
    await new Promise(r => setTimeout(r, 300));
    const env = envois[envois.length - 1];
    ok('gestes : JSON envoyé = scripts/fixtures/adresses-attendu.json, à l’octet', env && env.section === 'coordonnees' && commeSaveData(env.data) === FIX('adresses-attendu'), env ? commeSaveData(env.data) : 'aucun envoi');
    await p.close();
  }

  /* 3. ALLER-RETOUR et clé inconnue */
  {
    const { p, envois } = await ouvrir();
    await p.evaluate(() => publier()); await new Promise(r => setTimeout(r, 300));
    ok('aller-retour : publier sans rien changer réécrit le fichier à l’octet', envois[0] && commeSaveData(envois[0].data) === FIX('coordonnees'), envois[0] ? commeSaveData(envois[0].data) : 'aucun envoi');
    await p.close();
    const avecCle = JSON.parse(FIX('coordonnees')); avecCle.sites[1].horaires = 'garde-moi'; avecCle.note = { x: 1 };
    const q = await ouvrir(JSON.stringify(avecCle, null, 2) + '\n');
    await retaper(q.p, '#editCorps .f-champ[data-champ="portable"]', '06 12 34 56 78');
    await q.p.click('#btnPublier'); await new Promise(r => setTimeout(r, 300));
    const e = q.envois[0];
    ok('clés inconnues (d’un site, de la racine) conservées', e && e.data.sites[1].horaires === 'garde-moi' && e.data.note && e.data.note.x === 1, JSON.stringify(e && e.data));
    await q.p.close();
  }

  /* 4. NUMÉRO INVALIDE */
  {
    const { p, envois } = await ouvrir();
    await retaper(p, '#editCorps .f-champ[data-champ="standard"]', '12 34');
    const r = await p.evaluate(() => {
      const li = document.querySelector('#editCorps .f-champ[data-champ="standard"]').closest('.f-ligne');
      const m = li.querySelector('.f-manque');
      return { marquee: li.classList.contains('f-ligne--manque'), message: m && m.getClientRects().length ? m.textContent.trim() : null,
               actif: !document.getElementById('btnPublier').disabled, txt: document.getElementById('btnPublier').textContent.trim() };
    });
    ok('invalide : ligne marquée, message « Numéro non reconnu… »', r.marquee && /^Numéro non reconnu/.test(r.message || ''), JSON.stringify(r));
    ok('invalide : « Publier » inactif', r.txt === 'Publier' && !r.actif, JSON.stringify(r));
    await p.evaluate(() => publier()); await new Promise(r => setTimeout(r, 300));
    ok('invalide : rien n’est envoyé', envois.length === 0, JSON.stringify(envois));
    await p.close();
  }

  /* 5. LE SITE PUBLIC, servi avec le JSON envoyé */
  {
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true });
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url());
      if (u.pathname === '/_data/coordonnees.json') return r.respond({ status: 200, contentType: 'application/json', body: FIX('adresses-attendu') });
      if (u.hostname !== 'localhost') return r.respond({ status: 204, body: '' });   // rien ne sort (carte Google au clic seulement)
      r.continue();
    });
    await p.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 300));
    const zones = await p.evaluate(() => {
      const ZONES = [['menu', '.mnav-appel'], ['haut de page', 'header.hero'], ['rendez-vous', '#rdv'], ['infos', '#infos'], ['pied de page', 'footer']];
      return ZONES.map(([nom, sel]) => {
        const z = document.querySelector(sel);
        const nums = z ? [...z.querySelectorAll('.cms-tel-portable')].map(e => e.textContent.trim()) : [];
        const liens = z ? [...z.querySelectorAll('.cms-tellink-portable')].map(a => a.getAttribute('href')) : [];
        return { nom, nums, liens };
      });
    });
    zones.forEach(z => ok(`site : nouveau portable dans « ${z.nom} », lien d’appel compris`,
      z.nums.length > 0 && z.nums.every(n => n === '06 12 34 56 78') && z.liens.length > 0 && z.liens.every(h => h === 'tel:+33612345678'), JSON.stringify(z)));
    const aix = await p.evaluate(() => ({ infos: (document.querySelector('#infos .cms-adr-aix') || {}).innerText, pied: (document.querySelector('footer .cms-adrl-aix') || {}).innerText }));
    ok('site : nouvelle adresse d’Aix dans « Adresses. » et dans le pied de page',
      /Pavillon 8/.test(aix.infos || '') && /Pavillon 8/.test(aix.pied || ''), JSON.stringify(aix));
    await p.close();
  }

  await b.close();
  console.log(`\n${total - echecs}/${total} vérifications passées`);
  process.exit(echecs ? 1 : 0);
})();
