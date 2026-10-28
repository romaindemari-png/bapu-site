/* ============================================================
   Captures de l'admin pour vérification à l'œil — à 390 et 1280 px, nuit et jour.
   Usage :  python3 -m http.server <port>   (à la racine du dépôt)
            node scripts/captures.js <port> <dossier de sortie> [préfixe]
   Les /_data/*.json servis sont les COPIES GELÉES de scripts/fixtures/ ; save-data
   est INTERCEPTÉ (rien n'est écrit). Bypass localhost : l'admin s'ouvre connecté.
   ============================================================ */
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }

const PORT = process.argv[2] || '8765';
const SORTIE = process.argv[3] || '.';
const PREFIXE = process.argv[4] || 'admin';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MSG = "openEdit(toutesLesCartes().find(c => c.edit === 'message'))";
const ADR = "openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees'))";
const ECRANS = [
  ['1-accueil', ''],
  ['2-volet-compte', 'basculerVoletCompte()'],
  ['2b-accueil-publication', "window.__LELAB_TEMPS = 1; const p = debutPublication('coordonnees'); publicationEnvoyee(p, { ...donnees.coordonnees, x: 1 })"],
  ['3-adresses', "openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees'))"],
  ['4-message', MSG],
  ['6-publier-modifie', ADR + "; const t = document.querySelectorAll('#editCorps input[type=tel]')[1]; t.value = '06 12 34 56 78'; t.dispatchEvent(new Event('input', { bubbles: true }))"],
  ['7-publier-envoye', ADR + "; window.__LELAB_TEMPS = 1; const p = debutPublication('coordonnees'); publicationEnvoyee(p, { ...donnees.coordonnees, x: 1 })"],
  ['8-publier-en-ligne', ADR + "; const p = debutPublication('coordonnees'); p.etat = 'envoye'; annoncerEnLigne(p)"],
  ['5-connexion', "document.body.classList.remove('authed')"],
];

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const faits = [];
  for (const largeur of [390, 1280]) for (const chromie of ['nuit', 'jour']) for (const [nom, geste] of ECRANS){
    const p = await b.newPage();
    await p.setViewport({ width: largeur, height: largeur > 960 ? 900 : 844, isMobile: largeur <= 960, deviceScaleFactor: 2 });
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: chromie === 'nuit' ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/.netlify/functions/')) return r.respond({ status: 200, contentType: 'application/json', body: '{"success":true}' });
      const m = u.pathname.match(/^\/_data\/([a-z0-9-]+)\.json$/);
      if (!m) return r.continue();
      const f = path.join(__dirname, 'fixtures', m[1] + '.json');
      return fs.existsSync(f) ? r.respond({ status: 200, contentType: 'application/json', body: fs.readFileSync(f, 'utf8') }) : r.respond({ status: 404, body: '' });
    });
    await p.goto(`http://localhost:${PORT}/admin/`, { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => document.body.classList.contains('authed') && document.querySelectorAll('#siteCards .card').length > 0, { timeout: 15000 });
    await p.evaluate(() => document.fonts.ready);
    if (geste) await p.evaluate(geste);
    await new Promise(r => setTimeout(r, 400));
    const fichier = path.join(SORTIE, `${PREFIXE}-${largeur}-${chromie}-${nom}.png`);
    await p.screenshot({ path: fichier, fullPage: true });
    faits.push(fichier);
    await p.close();
  }
  await b.close();
  faits.forEach(f => console.log(f));
})();
