/* ============================================================
   B6 — LA FEUILLE « MESSAGE D'INFO » (LELAB-DESIGN §4 ; _data/info.json, lu par js/main.js)
   Usage :  python3 -m http.server <port>   (à la racine du dépôt)
            node scripts/test-feuille-message.js [http://localhost:<port>]

   Des GESTES DE CLIENT (clic, frappe, ⌘B, Entrée). info.json servi = COPIE GELÉE (scripts/fixtures/
   info.json) ; save-data INTERCEPTÉ, rien n'est écrit. Les dates se règlent par leur valeur (le sélecteur
   natif n'a pas de geste clavier fiable) ; tout le reste au clavier et à la souris.

   1. LA FEUILLE : afficher, bannière / fenêtre, titre, texte (le gras en gras, pas de « ** »), dates ;
      plus de « Petit intitulé », de « Partir d'un modèle », ni de syntaxe technique.
   2. GESTES → JSON : le JSON envoyé est scripts/fixtures/message-attendu.json, ÉCRIT À LA MAIN (l'id,
      tiré au hasard, est vérifié à part : nouveau, de la forme msg-…).
   3. L'ID : régénéré si le titre ou le texte change ; STABLE si seuls les dates, le format ou l'affichage changent.
   4. À L'OCTET : publier sans rien changer — même après être entré dans le texte — réécrit le fichier tel quel.
   5. SEULS <strong> ET <br> : un collage arrive en texte brut ; toute autre balise du champ est retirée.
   6. À CORRIGER : affiché sans titre → « Il manque le titre » sous sa ligne, bouton « 1 point à corriger » ;
      fin avant début en plus → « 2 points à corriger » ; rien ne part.
   7. LE SITE : le JSON envoyé, servi au site public (horloge dans les dates), ouvre la FENÊTRE avec le titre
      et le texte en gras ; en type bannière, c'est la BANNIÈRE qui s'ouvre.
   ============================================================ */
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIX = f => fs.readFileSync(path.join(__dirname, 'fixtures', f + '.json'), 'utf8');
const ORIG = JSON.parse(FIX('info'));
const commeSaveData = d => JSON.stringify(d, null, 2) + '\n';
const pause = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0, total = 0;
function ok(nom, cond, detail){ total++; if (!cond) echecs++; console.log((cond ? '✓ ' : '✗ ') + nom + (cond || detail === undefined ? '' : '\n    → ' + detail)); }

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  async function ouvrir(){
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
    const envois = [];
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url());
      if (u.pathname === '/.netlify/functions/save-data'){ envois.push(JSON.parse(r.postData())); return r.respond({ status: 200, contentType: 'application/json', body: '{"success":true}' }); }
      const m = u.pathname.match(/^\/_data\/([a-z0-9-]+)\.json$/);
      if (!m) return r.continue();
      const f = path.join(__dirname, 'fixtures', m[1] + '.json');
      return fs.existsSync(f) ? r.respond({ status: 200, contentType: 'application/json', body: fs.readFileSync(f, 'utf8') }) : r.respond({ status: 404, body: '' });
    });
    p.on('pageerror', e => ok('aucune erreur JS', false, e.message));
    await p.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => document.body.classList.contains('authed') && document.querySelectorAll('#siteCards .card').length > 0, { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => { session = { access_token: 'test', refresh_token: 'test', expires_at: Date.now() + 3600e3 }; });
    await p.click('#siteCards .card[data-edit="message"]');
    await p.waitForSelector('#screen-edit.active');
    return { p, envois };
  }
  const envoyer = async (p, envois) => { const n = envois.length; await p.click('#btnPublier'); await pause(300); return envois.length > n ? envois[envois.length - 1] : null; };
  async function retaper(p, sel, texte){
    const el = await p.$(sel); if (!el){ ok('champ présent : ' + sel, false); return; }
    await el.click({ clickCount: 3 });
    await p.keyboard.down('Meta'); await p.keyboard.press('KeyA'); await p.keyboard.up('Meta');
    await p.keyboard.press('Backspace');
    if (texte) await p.keyboard.type(texte);
  }
  const date = (p, i, v) => p.evaluate((i, v) => { const d = document.querySelectorAll('#editCorps .f-date')[i]; d.value = v; d.dispatchEvent(new Event('input', { bubbles: true })); d.dispatchEvent(new Event('change', { bubbles: true })); }, i, v);
  const TEXTE = '#editCorps .f-msg-texte', TITRE = '#editCorps .f-msg-titre';
  /* « Tout sélectionner » dans le texte : ⌘A n'agit pas sur une zone éditable dans Chrome sans fenêtre ; on pose la
     même sélection (toute la zone) qu'un client obtient au doigt, puis tout le reste se fait au clavier. */
  const toutSelectionner = p => p.evaluate(sel => { const t = document.querySelector(sel); t.focus(); const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, TEXTE);

  /* 1. LA FEUILLE */
  {
    const { p } = await ouvrir();
    const r = await p.evaluate(() => {
      const f = document.querySelector('#editCorps .feuille');
      return {
        feuille: !!f && f.classList.contains('grain-papier'),
        titre: (document.querySelector('#editCorps .f-msg-titre') || {}).value,
        gras: [...document.querySelectorAll('#editCorps .f-msg-texte strong')].map(s => s.textContent),
        actif: (document.querySelector('#editCorps .switch input') || {}).checked,
        type: (document.querySelector('#editCorps input[name="msg-type"]:checked') || {}).value,
        dates: [...document.querySelectorAll('#editCorps .f-date')].map(d => d.value),
        texteEcran: document.getElementById('screen-edit').innerText,
        h1: document.getElementById('editTitre').textContent, sur: document.getElementById('editSur').textContent,
      };
    });
    ok('feuille : papier grainé, titre et réglages lus dans info.json', r.feuille && r.titre === ORIG.titre && r.actif === ORIG.actif && r.type === ORIG.type
      && JSON.stringify(r.dates) === JSON.stringify([ORIG.dateDebut, ORIG.dateFin]), JSON.stringify(r));
    ok('feuille : le gras s’affiche en gras', JSON.stringify(r.gras) === JSON.stringify([' 26 au 30 octobre 2026 inclus']), JSON.stringify(r.gras));
    ok('feuille : titre « Message d’info », surtitre « 01 · … »', r.h1 === 'Message d’info' && /^01 · /.test(r.sur), JSON.stringify([r.h1, r.sur]));
    ok('feuille : aucune syntaxe technique (« ** », « Petit intitulé », « Partir d’un modèle »)', !/\*\*|Petit intitulé|Partir d.un modèle/.test(r.texteEcran), r.texteEcran.match(/.{0,20}(\*\*|Petit intitulé|Partir d.un modèle).{0,20}/));
    await p.close();
  }

  /* 2. GESTES → JSON écrit à la main */
  {
    const { p, envois } = await ouvrir();
    await retaper(p, TITRE, 'Fermeture des vacances');
    await p.click(TEXTE); await toutSelectionner(p);
    await p.keyboard.press('Backspace');
    await p.keyboard.type('Le BAPU est fermé du ');
    await p.keyboard.down('Meta'); await p.keyboard.press('KeyB'); await p.keyboard.up('Meta');
    await p.keyboard.type('21 au 24 décembre');
    await p.keyboard.down('Meta'); await p.keyboard.press('KeyB'); await p.keyboard.up('Meta');
    await p.keyboard.press('Enter');
    await p.keyboard.type('Réouverture le lundi 4 janvier.');
    await date(p, 0, '2026-12-21'); await date(p, 1, '2026-12-24');
    await p.click('#editCorps input[name="msg-type"][value="popup"] + span');
    const env = await envoyer(p, envois);
    const recu = env ? { ...env.data } : null;
    ok('gestes : nouvel id, de la forme msg-…', recu && recu.id !== ORIG.id && /^msg-[0-9a-z]+$/.test(recu.id), recu && recu.id);
    if (recu) recu.id = 'NOUVEL-ID';
    ok('gestes : JSON envoyé = scripts/fixtures/message-attendu.json, à l’octet (id à part)', recu && commeSaveData(recu) === FIX('message-attendu'), recu ? commeSaveData(recu) : 'aucun envoi');
    await p.close();
  }

  /* 3. L'ID */
  const CAS_ID = [
    ['dates seules', 'stable', async p => { await date(p, 1, '2026-11-15'); }],
    ['format seul', 'stable', async p => { await p.click('#editCorps input[name="msg-type"][value="popup"] + span'); }],
    ['affichage seul', 'stable', async p => { await p.click('#editCorps .switch'); }],
    ['titre', 'nouvel', async p => { await retaper(p, TITRE, 'Autre titre'); }],
    ['texte', 'nouvel', async p => { await p.click(TEXTE); await p.keyboard.press('End'); await p.keyboard.type(' Merci.'); }],
  ];
  for (const [nom, attendu, geste] of CAS_ID){
    const { p, envois } = await ouvrir();
    await geste(p);
    const env = await envoyer(p, envois);
    const id = env && env.data.id;
    ok(`id : ${nom} → ${attendu === 'stable' ? 'id inchangé' : 'nouvel id'}`, env && (attendu === 'stable' ? id === ORIG.id : (id !== ORIG.id && /^msg-/.test(id))), JSON.stringify({ id, envoye: !!env }));
    await p.close();
  }

  /* 4. À L'OCTET */
  {
    const { p, envois } = await ouvrir();
    await p.click(TEXTE); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowRight');
    await p.click(TITRE);
    const actif = await p.evaluate(() => !document.getElementById('btnPublier').disabled);
    ok('octet : entrer dans le texte sans rien changer n’allume pas « Publier »', !actif);
    await p.evaluate(() => publier()); await pause(300);
    ok('octet : publier sans rien changer réécrit info.json tel quel', envois[0] && commeSaveData(envois[0].data) === FIX('info'), envois[0] ? commeSaveData(envois[0].data) : 'aucun envoi');
    await p.close();
  }

  /* 5. SEULS <strong> ET <br> */
  {
    const { p, envois } = await ouvrir();
    await p.click(TEXTE); await toutSelectionner(p);
    await p.keyboard.press('Backspace');
    await p.keyboard.type('Avant ');
    await p.evaluate(sel => {
      const dt = new DataTransfer(); dt.setData('text/html', '<em>collé</em> <a href="https://x.fr">lien</a>'); dt.setData('text/plain', 'collé lien');
      document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, TEXTE);
    let env = await envoyer(p, envois);
    ok('collage : arrive en texte brut', env && env.data.texte === 'Avant collé lien', env && env.data.texte);
    await p.close();
    const q = await ouvrir();
    await q.p.evaluate(sel => {
      const t = document.querySelector(sel);
      t.innerHTML = 'A <i>b</i> <span style="color:red">c</span><div>d <b>e</b></div>';
      t.dispatchEvent(new Event('input', { bubbles: true }));
    }, TEXTE);
    env = await envoyer(q.p, q.envois);
    ok('balises : seules <strong> et <br> restent', env && env.data.texte === 'A b c<br>d <strong>e</strong>', env && env.data.texte);
    await q.p.close();
  }

  /* 6. À CORRIGER */
  {
    const { p, envois } = await ouvrir();
    await retaper(p, TITRE, '');
    const r1 = await p.evaluate(() => ({ txt: document.getElementById('btnPublier').textContent.trim(), actif: !document.getElementById('btnPublier').disabled,
      dessous: document.getElementById('publierLigne').innerText.trim(),
      manque: [...document.querySelectorAll('#editCorps .f-ligne--manque .f-manque')].map(m => m.textContent) }));
    ok('à corriger : « Il manque le titre » sous sa ligne, « 1 point à corriger », rien dessous', r1.txt === '1 point à corriger' && !r1.actif && r1.dessous === ''
      && JSON.stringify(r1.manque) === '["Il manque le titre"]', JSON.stringify(r1));
    await date(p, 0, '2026-12-31'); await date(p, 1, '2026-12-01');
    const r2 = await p.evaluate(() => ({ txt: document.getElementById('btnPublier').textContent.trim(), manque: [...document.querySelectorAll('#editCorps .f-ligne--manque .f-manque')].map(m => m.textContent) }));
    ok('à corriger : fin avant début en plus → « 2 points à corriger »', r2.txt === '2 points à corriger' && r2.manque.includes('La fin est avant le début'), JSON.stringify(r2));
    await p.evaluate(() => publier()); await pause(300);
    ok('à corriger : rien ne part', envois.length === 0, JSON.stringify(envois));
    await p.close();
  }

  /* 7. LE SITE PUBLIC */
  for (const type of ['popup', 'banniere']){
    const attendu = JSON.parse(FIX('message-attendu')); attendu.type = type; attendu.id = 'msg-sonde-' + type;
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true });
    await p.evaluateOnNewDocument(T => { const D = Date; class F extends D { constructor(...a){ a.length ? super(...a) : super(T); } static now(){ return T; } } window.Date = F; }, new Date(2026, 11, 22, 10).getTime());
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url());
      if (u.pathname === '/_data/info.json') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(attendu) });
      if (u.hostname !== 'localhost') return r.respond({ status: 204, body: '' });
      r.continue();
    });
    await p.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await pause(500);
    const r = await p.evaluate(t => {
      const root = document.getElementById(t === 'popup' ? 'infoPop' : 'infoBan'), autre = document.getElementById(t === 'popup' ? 'infoBan' : 'infoPop');
      const txt = root.querySelector(t === 'popup' ? '#infoTexte' : '#infoBanTexte'), ti = root.querySelector(t === 'popup' ? '#infoTitre' : '#infoBanTitre');
      return { ouvert: root.classList.contains('open') && getComputedStyle(root).visibility !== 'hidden', autre: autre.classList.contains('open'),
               titre: ti && ti.textContent, gras: txt ? [...txt.querySelectorAll('strong')].map(s => s.textContent) : [], br: txt ? txt.querySelectorAll('br').length : 0 };
    }, type);
    ok(`site : ${type === 'popup' ? 'la fenêtre' : 'la bannière'} s’ouvre, l’autre non`, r.ouvert && !r.autre, JSON.stringify(r));
    ok(`site (${type}) : titre, texte en gras et retour à la ligne`, r.titre === 'Fermeture des vacances' && JSON.stringify(r.gras) === '["21 au 24 décembre"]' && r.br === 1, JSON.stringify(r));
    await p.close();
  }

  await b.close();
  console.log(`\n${total - echecs}/${total} vérifications passées`);
  process.exit(echecs ? 1 : 0);
})();
