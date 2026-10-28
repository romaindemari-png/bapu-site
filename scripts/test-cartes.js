/* ============================================================
   B3 — LES DEUX CARTES DE « MON SITE » (LELAB-DESIGN §2, §4 ; planche « BAPU · vraies données »)
   Usage :  python3 -m http.server <port>   (à la racine du dépôt)
            node scripts/test-cartes.js [http://localhost:<port>] [dossier des captures]

   /_data/*.json = COPIES GELÉES de scripts/fixtures/ ; info.json décliné EN MÉMOIRE pour chaque
   état du message (jamais écrit) ; save-data INTERCEPTÉ ; HORLOGE FIGÉE au mercredi 28/10/2026, 10 h.

   1. L'ORDRE DU SITE : 01 Message d'info (bannière fixée en haut / fenêtre à l'arrivée), 02 Adresses.
   2. LE MESSAGE — la couleur dit l'état (§2), le surtitre dit pourquoi :
        en ligne, fin lointaine ...... papier  « 01 · Jusqu’au 31 déc. »
        fin dans 7 jours ou moins .... violet  « 01 · Jusqu’au 31 oct. »
        terminé, encore actif ........ violet  « 01 · Terminé le 25/10 : à retirer ou à remplacer »
        désactivé .................... contour « 01 · Masqué »
        programmé .................... papier  « 01 · Programmé le 2 nov. »
      puis le titre du message et « Bannière · page d’accueil » / « Fenêtre · page d’accueil ».
   3. LES ADRESSES — valeurs lues dans coordonnees.json (copie gelée) : téléphone : le standard en
      grand ; desktop : quatre lignes à filets (standard, portable, Marseille, Aix).
   4. AUCUNE MINIATURE SUR BLANC : aucun fond #FFFFFF dans les cartes.
   5. Une carte ouvre son éditeur.
   Captures : une par état du message, à 390 et 1280 (si un dossier est donné).
   ============================================================ */
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const CAPTURES = process.argv[3] || '';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIX = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f + '.json'), 'utf8'));
const MIDI = new Date(2026, 9, 28, 10, 0).getTime();

let echecs = 0, total = 0;
function ok(nom, cond, detail){ total++; if (!cond) echecs++; console.log((cond ? '✓ ' : '✗ ') + nom + (cond || detail === undefined ? '' : '\n    → ' + detail)); }

(async () => {
  if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  async function ouvrir({ info, largeur = 390, chromie = 'nuit' } = {}){
    const p = await b.newPage();
    await p.setViewport({ width: largeur, height: largeur > 960 ? 900 : 844, isMobile: largeur <= 960, deviceScaleFactor: 2 });
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: chromie === 'nuit' ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.evaluateOnNewDocument(T => {
      const D = Date;
      class Fige extends D { constructor(...a){ a.length ? super(...a) : super(T); } static now(){ return T; } }
      window.Date = Fige;
    }, MIDI);
    const donnees = { info: info || FIX('info'), config: FIX('config'), coordonnees: FIX('coordonnees'), textes: FIX('textes') };
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/.netlify/functions/')) return r.respond({ status: 200, contentType: 'application/json', body: '{"success":true}' });
      const m = u.pathname.match(/^\/_data\/([a-z0-9-]+)\.json$/);
      if (!m) return r.continue();
      return donnees[m[1]] ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(donnees[m[1]]) }) : r.respond({ status: 404, body: '' });
    });
    p.on('pageerror', e => ok('aucune erreur JS', false, e.message));
    await p.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => document.body.classList.contains('authed') && document.querySelectorAll('#siteCards .card').length > 0, { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => document.fonts.ready);
    return p;
  }
  /* Ce que le client VOIT d'une carte : textes visibles, état, fond. */
  const lireCartes = p => p.evaluate(() => {
    const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    const txt = (c, s) => { const e = c.querySelector(s); return vis(e) ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return [...document.querySelectorAll('#siteCards .card')].map(c => {
      const st = getComputedStyle(c);
      return {
        edit: c.dataset.edit, etat: c.dataset.etat, fond: st.backgroundColor, bord: st.borderTopStyle,
        sur: txt(c, '.card-sur'), titre: txt(c, '.card-t'), sTitre: txt(c, '.s-titre'), sFormat: txt(c, '.s-format'),
        gros: txt(c, '.s-gros'), legende: txt(c, '.s-legende'),
        lignes: [...c.querySelectorAll('.s-ligne')].filter(vis).map(l => [l.querySelector('.s-lib').textContent.trim(), l.querySelector('.s-val').textContent.trim()]),
        fleche: vis(c.querySelector('.arrow')),
        blancs: [c, ...c.querySelectorAll('*')].filter(e => vis(e) && /^rgba?\(255, 255, 255(, 1)?\)$/.test(getComputedStyle(e).backgroundColor)).length,
      };
    });
  });
  const PAPIER = 'rgb(244, 239, 230)', VIOLET = 'rgb(202, 180, 255)';
  const info = ch => ({ ...FIX('info'), ...ch });
  const coord = FIX('coordonnees');

  /* 1 + 2. ÉTATS DU MESSAGE */
  const ETATS = [
    ['en-ligne', info({ dateDebut: '2026-10-20', dateFin: '2026-12-31' }), 'a-jour', PAPIER, '01 · Jusqu’au 31 déc.', 'Bannière · page d’accueil'],
    ['expire-bientot', info({ dateDebut: '2026-10-20', dateFin: '2026-10-31' }), 'a-voir', VIOLET, '01 · Jusqu’au 31 oct.', 'Bannière · page d’accueil'],
    ['termine-actif', info({ dateDebut: '2026-10-01', dateFin: '2026-10-25' }), 'a-voir', VIOLET, '01 · Terminé le 25/10 : à retirer ou à remplacer', 'Bannière · page d’accueil'],
    ['desactive', info({ actif: false }), 'masque', 'rgba(0, 0, 0, 0)', '01 · Masqué', 'Bannière · page d’accueil'],
    ['programme-fenetre', info({ type: 'popup', dateDebut: '2026-11-02', dateFin: '2026-11-20' }), 'a-jour', PAPIER, '01 · Programmé le 2 nov.', 'Fenêtre · page d’accueil'],
  ];
  for (const [nom, inf, etat, fond, sur, format] of ETATS){
    for (const largeur of [390, 1280]){
      const p = await ouvrir({ info: inf, largeur });
      const cs = await lireCartes(p);
      const m = cs[0] || {};
      if (largeur === 390){
        ok(`ordre : 01 message, 02 adresses (${nom})`, JSON.stringify(cs.map(c => c.edit)) === '["message","coordonnees"]', JSON.stringify(cs.map(c => c.edit)));
        ok(`message ${nom} : état ${etat}, fond ${fond}${etat === 'masque' ? ', contour pointillé' : ''}`,
          m.etat === etat && m.fond === fond && (etat !== 'masque' || m.bord === 'dashed'), JSON.stringify({ etat: m.etat, fond: m.fond, bord: m.bord }));
        ok(`message ${nom} : surtitre « ${sur} »`, m.sur === sur, m.sur);
        ok(`message ${nom} : « Message d’info », titre du message, « ${format} »`,
          m.titre === 'Message d’info' && m.sTitre === inf.titre && m.sFormat === format, JSON.stringify([m.titre, m.sTitre, m.sFormat]));
        ok(`message ${nom} : flèche, aucun fond blanc`, m.fleche && cs.every(c => c.blancs === 0), JSON.stringify(cs.map(c => c.blancs)));
      }
      if (CAPTURES) await p.screenshot({ path: path.join(CAPTURES, `b3-${largeur}-message-${nom}.png`), fullPage: true });
      await p.close();
    }
  }

  /* 3. LES ADRESSES */
  const unLigne = s => s.adresse.join(' ');
  {
    const p = await ouvrir({ largeur: 390 });
    const a = (await lireCartes(p))[1] || {};
    ok('adresses, téléphone : « Adresses & téléphones », papier', a.titre === 'Adresses & téléphones' && a.etat === 'a-jour' && a.fond === PAPIER, JSON.stringify([a.titre, a.etat, a.fond]));
    ok('adresses, téléphone : le standard en grand, lu dans coordonnees.json', a.gros === coord.telephones.standard && a.legende === 'Standard · Marseille et Aix', JSON.stringify([a.gros, a.legende]));
    ok('adresses, téléphone : pas de lignes (le standard seul)', a.lignes.length === 0, JSON.stringify(a.lignes));
    await p.close();
  }
  for (const chromie of ['nuit', 'jour']){
    const p = await ouvrir({ largeur: 1280, chromie });
    const a = (await lireCartes(p))[1] || {};
    const attendu = [['Standard · Marseille et Aix', coord.telephones.standard], ['Portable', coord.telephones.portable],
                     [coord.sites[0].nom, unLigne(coord.sites[0])], [coord.sites[1].nom, unLigne(coord.sites[1])]];
    ok(`adresses, desktop ${chromie} : quatre lignes, vraies valeurs, Aix comprise`, JSON.stringify(a.lignes) === JSON.stringify(attendu), JSON.stringify(a.lignes));
    ok(`adresses, desktop ${chromie} : le standard n'est pas répété en grand`, a.gros === null, a.gros);
    await p.close();
  }

  /* 5. Une carte ouvre son éditeur. */
  {
    const p = await ouvrir();
    await p.click('#siteCards .card[data-edit="coordonnees"]');
    const r = await p.evaluate(() => ({ ecran: document.getElementById('screen-edit').classList.contains('active'), titre: document.getElementById('editTitre').textContent }));
    ok('la carte « Adresses » ouvre son éditeur', r.ecran, JSON.stringify(r));
    await p.close();
  }

  await b.close();
  console.log(`\n${total - echecs}/${total} vérifications passées`);
  process.exit(echecs ? 1 : 0);
})();
