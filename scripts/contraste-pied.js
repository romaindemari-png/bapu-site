/* ============================================================
   CONTRASTE DU PIED DE PUBLIER, sur ses VRAIS PIXELS (29/10).
   Usage :  python3 -m http.server <port>   puis   node scripts/contraste-pied.js <port> [dossier des captures]

   Le pied n'a pas de fond à lui : un verre (flou + 80 % de --fond + grain) posé sur ce qui passe dessous
   (le fond de page, ou le papier d'une feuille). mesure-charte ne peut pas le calculer : on LIT les pixels.
   Pour le texte du bouton et pour la phrase dessous : capture de leur boîte, texte masqué (le verre reste),
   contraste WCAG de la couleur du texte contre CHAQUE pixel ; on retient le pire 1 % (centile 1, comme la
   charte pour le grain) et on donne le minimum. Seuil 4,5:1 (16 et 14 px).
   Cas : nuit / jour × feuille au chargement / feuille défilée, à 390 px, sur les deux feuilles.
   Données = copies gelées de scripts/fixtures/. Rien n'est écrit.
   ============================================================ */
const fs = require('fs'), path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }
const PORT = process.argv[2] || '8765', CAPTURES = process.argv[3] || '';
const lum = c => { const l = c.map(v => (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };

(async () => {
  if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 15000 });
  let echecs = 0;
  console.log('| chromie | feuille | position | texte | couleur | contraste pire 1 % | minimum | |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const chromie of ['nuit', 'jour']) for (const ed of ['coordonnees', 'message']) for (const position of ['au chargement', 'défilée']){
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.evaluateOnNewDocument(c => { try { localStorage.setItem('lelab_chromie', c); } catch (e) {} }, chromie);
    await p.setRequestInterception(true);
    p.on('request', r => {
      const m = new URL(r.url()).pathname.match(/^\/_data\/([a-z0-9-]+)\.json$/);
      if (!m) return r.continue();
      const f = path.join(__dirname, 'fixtures', m[1] + '.json');
      return fs.existsSync(f) ? r.respond({ status: 200, contentType: 'application/json', body: fs.readFileSync(f, 'utf8') }) : r.respond({ status: 404, body: '' });
    });
    await p.goto(`http://localhost:${PORT}/admin/`, { waitUntil: 'networkidle0' });
    if (process.env.VARIANTE) await p.addStyleTag({ content: process.env.VARIANTE });   // essai d'une variante, rien n'est écrit
    await p.waitForFunction(() => document.body.classList.contains('authed'), { timeout: 8000 });
    await p.evaluate(e => openEdit(toutesLesCartes().find(x => x.edit === e)), ed);
    await new Promise(r => setTimeout(r, 400));
    await p.evaluate(pos => window.scrollTo(0, pos === 'défilée' ? Math.round((document.documentElement.scrollHeight - innerHeight) / 2) : 0), position);
    await new Promise(r => setTimeout(r, 400));
    if (CAPTURES) await p.screenshot({ path: path.join(CAPTURES, `pied-390-${chromie}-${ed}-${position === 'défilée' ? 'defilee' : 'chargement'}.png`) });
    for (const [nom, sel] of [['bouton', '#btnPublier .pub-txt'], ['phrase', '#publierLigne .pub-phrase']]){
      const info = await p.evaluate(s => { const e = document.querySelector(s), r = e.getBoundingClientRect();
        return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, c: getComputedStyle(e).color }; }, sel);
      /* Texte du pied masqué (le verre reste) ; le badge « DEV » du bypass localhost, fixé en bas, n'existe pas en prod :
         masqué aussi (il donnait un faux 1,00:1). */
      await p.addStyleTag({ content: '.pied-publier *{color:transparent!important;border-color:transparent!important}.dev-badge{display:none!important}' });
      const b64 = await p.screenshot({ clip: { x: info.x, y: info.y, width: info.w, height: info.h }, encoding: 'base64' });
      await p.evaluate(() => { const st = [...document.querySelectorAll('style')].pop(); st.remove(); });
      const px = await p.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data, out = []; for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]); return out; }, b64);
      const t = info.c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const rs = px.map(q => ratio(t, q)).sort((a, b) => a - b);
      const p1 = rs[Math.floor(rs.length * 0.01)], min = rs[0], ok = p1 >= 4.5;
      if (!ok) echecs++;
      console.log(`| ${chromie} | ${ed} | ${position} | ${nom} | rgb(${t.join(',')}) | ${p1.toFixed(2)} | ${min.toFixed(2)} | ${ok ? '✅' : '❌'} |`);
    }
    await p.close();
  }
  await b.close();
  console.log(echecs ? `\n❌ ${echecs} texte(s) du pied sous 4,5:1` : '\n✅ texte du bouton et phrase du pied ≥ 4,5:1 (pire 1 %), nuit et jour, au chargement et défilée');
  process.exit(echecs ? 1 : 0);
})();
