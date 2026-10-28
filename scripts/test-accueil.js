/* ============================================================
   B2 — LA COQUILLE ET LA PHRASE D'ACCUEIL (LELAB-DESIGN §4, §5 ; planche « BAPU · vraies données »)
   Usage :  python3 -m http.server <port>   (à la racine du dépôt)
            node scripts/test-accueil.js [http://localhost:<port>]

   Les /_data/*.json servis sont les COPIES GELÉES de scripts/fixtures/ ; info.json est
   décliné EN MÉMOIRE de la sonde (jamais écrit) pour chaque état du message. save-data est
   INTERCEPTÉ. L'HORLOGE DE LA PAGE EST FIGÉE (mercredi 28/10/2026, 10 h, sauf mention) :
   sans ça, la phrase dépendrait du jour où l'on lance la sonde.

   1. LA PHRASE dit l'état réel du site :
        message en ligne, fin lointaine ........ « Votre site est à jour. »
        fin dans 7 jours ou moins ............. « Votre message s'arrête samedi. » (ce soir / demain)
        terminé mais encore actif ............. « Votre message est terminé. »
        désactivé ............................. « Votre site est à jour. »
        programmé (même s'il finit bientôt) ... « Votre site est à jour. »
      et le salut : « Bonjour Marie-Christine. » (« Bonsoir » à partir de 18 h).
   2. L'AVATAR : initiales du prénom (MC), sinon celles de cabinet.nom (BA).
   3. LE VOLET COMPTE s'ouvre sous l'avatar ; le toucher ne déconnecte pas ; Échap et un
      toucher dehors le ferment ; « Se déconnecter » déconnecte.
   4. LA COQUILLE : plus de sidebar, plus d'écran Accueil, plus de nav du bas ; « Mon site »
      est l'accueil ; « Le reste du site, c'est nous » + « Demander au studio »
      (mailto:contact@lestudmarseille.fr) ; aucune trace d'Instagram ni de LeLab+.
   ============================================================ */
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIX = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f + '.json'), 'utf8'));
const MIDI = new Date(2026, 9, 28, 10, 0).getTime();   // mercredi 28 octobre 2026, 10 h (heure locale)

let echecs = 0, total = 0;
function ok(nom, cond, detail){ total++; if (!cond) echecs++; console.log((cond ? '✓ ' : '✗ ') + nom + (cond || detail === undefined ? '' : '\n    → ' + detail)); }

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const requetes = [];
  async function ouvrir({ info, config, heure } = {}){
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
    const t = heure || MIDI;
    await p.evaluateOnNewDocument(T => {
      const D = Date;
      class Fige extends D { constructor(...a){ a.length ? super(...a) : super(T); } static now(){ return T; } }
      window.Date = Fige;
    }, t);
    const donnees = { info: info || FIX('info'), config: config || FIX('config'), coordonnees: FIX('coordonnees'), textes: FIX('textes') };
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url()); requetes.push(u.pathname);
      if (u.pathname.startsWith('/.netlify/functions/')) return r.respond({ status: 200, contentType: 'application/json', body: '{"success":true}' });
      const m = u.pathname.match(/^\/_data\/([a-z0-9-]+)\.json$/);
      if (!m) return r.continue();
      return donnees[m[1]] ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(donnees[m[1]]) }) : r.respond({ status: 404, body: '' });
    });
    p.on('pageerror', e => ok('aucune erreur JS', false, e.message));
    await p.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => document.body.classList.contains('authed') && document.querySelectorAll('#siteCards .card').length > 0, { timeout: 15000 }).catch(() => {});
    return p;
  }
  const phrase = p => p.evaluate(() => {
    const s = document.getElementById('accueilSalut'), e = document.getElementById('accueilEtat');
    return [s && s.textContent.trim(), e && e.textContent.trim()].join(' | ');
  });
  const info = changements => ({ ...FIX('info'), ...changements });

  /* 1. LA PHRASE */
  const CAS = [
    ['message en ligne, fin lointaine', info({ dateDebut: '2026-10-20', dateFin: '2026-12-31' }), 'Bonjour Marie-Christine. | Votre site est à jour.'],
    ['fin samedi (dans 3 jours)', info({ dateDebut: '2026-10-20', dateFin: '2026-10-31' }), 'Bonjour Marie-Christine. | Votre message s’arrête samedi.'],
    ['fin dans 7 jours (mercredi prochain)', info({ dateDebut: '2026-10-20', dateFin: '2026-11-04' }), 'Bonjour Marie-Christine. | Votre message s’arrête mercredi 4 novembre.'],
    ['fin dans 8 jours', info({ dateDebut: '2026-10-20', dateFin: '2026-11-05' }), 'Bonjour Marie-Christine. | Votre site est à jour.'],
    ['fin demain', info({ dateDebut: '2026-10-20', dateFin: '2026-10-29' }), 'Bonjour Marie-Christine. | Votre message s’arrête demain.'],
    ['fin aujourd’hui', info({ dateDebut: '2026-10-20', dateFin: '2026-10-28' }), 'Bonjour Marie-Christine. | Votre message s’arrête ce soir.'],
    ['terminé mais encore actif', info({ dateDebut: '2026-10-01', dateFin: '2026-10-25' }), 'Bonjour Marie-Christine. | Votre message est terminé.'],
    ['désactivé (dates passées)', info({ actif: false, dateDebut: '2026-10-01', dateFin: '2026-10-25' }), 'Bonjour Marie-Christine. | Votre site est à jour.'],
    ['programmé, finit dans 5 jours', info({ dateDebut: '2026-11-01', dateFin: '2026-11-02' }), 'Bonjour Marie-Christine. | Votre site est à jour.'],
    ['sans date de fin', info({ dateDebut: '', dateFin: '' }), 'Bonjour Marie-Christine. | Votre site est à jour.'],
  ];
  for (const [nom, inf, attendu] of CAS){
    const p = await ouvrir({ info: inf });
    const lu = await phrase(p);
    ok(`phrase — ${nom}`, lu === attendu, lu);
    await p.close();
  }
  {
    const p = await ouvrir({ heure: new Date(2026, 9, 28, 19, 0).getTime(), info: info({ dateDebut: '2026-10-20', dateFin: '2026-12-31' }) });
    const lu = await phrase(p);
    ok('salut — « Bonsoir » à 19 h', lu === 'Bonsoir Marie-Christine. | Votre site est à jour.', lu);
    await p.close();
  }
  {
    const p = await ouvrir({ info: info({ dateDebut: '2026-10-20', dateFin: '2026-10-31' }) });
    const em = await p.evaluate(() => { const e = document.querySelector('#accueilEtat em'); return e && e.textContent; });
    ok('le jour de fin est mis en relief (em)', em === 'samedi', em);
    await p.close();
  }

  /* 2. L'AVATAR */
  {
    const p = await ouvrir();
    const av = await p.evaluate(() => { const a = document.getElementById('avatarInit'); return a && a.textContent.trim(); });
    ok('avatar : initiales du prénom (MC)', av === 'MC', av);
    await p.close();
    const cfg = FIX('config'); delete cfg.cabinet.prenom;
    const q = await ouvrir({ config: cfg });
    const r = await q.evaluate(() => ({ av: (document.getElementById('avatarInit') || {}).textContent, salut: (document.getElementById('accueilSalut') || {}).textContent }));
    ok('sans prénom : initiales de cabinet.nom (BA) et « Bonjour. »', r.av && r.av.trim() === 'BA' && r.salut && r.salut.trim() === 'Bonjour.', JSON.stringify(r));
    await q.close();
  }

  /* 3. LE VOLET COMPTE */
  {
    const p = await ouvrir();
    const etat = () => p.evaluate(() => {
      const v = document.getElementById('voletCompte'), a = document.getElementById('avatarInit');
      const rv = v && v.getBoundingClientRect(), ra = a && a.getBoundingClientRect();
      return { ouvert: !!(v && !v.hidden && v.getClientRects().length), authed: document.body.classList.contains('authed'),
               dessous: !!(rv && ra && rv.top >= ra.bottom - 1), expanded: a && a.getAttribute('aria-expanded'),
               nom: v && (v.querySelector('#voletNom') || {}).textContent };
    });
    const avatar = await p.$('#avatarInit');
    ok('volet : fermé au départ', avatar && !(await etat()).ouvert);
    if (avatar){
      await avatar.click();
      let e = await etat();
      ok('volet : le toucher sur l’avatar l’ouvre, sous l’avatar, et ne déconnecte pas', e.ouvert && e.dessous && e.authed && e.expanded === 'true', JSON.stringify(e));
      ok('volet : porte le prénom', e.nom && e.nom.includes('Marie-Christine'), JSON.stringify(e));
      await p.keyboard.press('Escape');
      ok('volet : Échap le ferme', !(await etat()).ouvert);
      await avatar.click(); await p.mouse.click(30, 700);
      e = await etat();
      ok('volet : un toucher dehors le ferme, toujours connecté', !e.ouvert && e.authed, JSON.stringify(e));
      await avatar.click(); await p.click('#voletCompte .vc-sortie');
      ok('volet : « Se déconnecter » déconnecte', !(await etat()).authed);
    }
    await p.close();
  }

  /* 4. LA COQUILLE */
  {
    const p = await ouvrir();
    const r = await p.evaluate(() => {
      const vis = s => [...document.querySelectorAll(s)].some(e => e.getClientRects().length);
      const studio = [...document.querySelectorAll('a[href^="mailto:"]')].find(a => /Demander au studio/.test(a.textContent));
      return {
        sidebar: !!document.querySelector('.sidebar'), navBas: !!document.querySelector('.nav-bas'),
        dashboard: !!document.getElementById('screen-dashboard'), topbarM: !!document.querySelector('.topbar-m'),
        barre: vis('.barre'), logo: vis('.barre .logo-nuit, .barre .logo-jour'),
        monsiteActif: document.getElementById('screen-monsite').classList.contains('active'),
        reste: /Le reste du site, c’est nous\./.test(document.body.innerText),
        mail: studio ? studio.getAttribute('href') : null,
        insta: /instagram/i.test(document.documentElement.innerHTML), plus: /lelab-plus|LeLab\+/i.test(document.documentElement.innerHTML),
        boutonAccueil: !!document.querySelector('#screen-monsite button.btn, #btnAccueil'), toutEnLigne: /Tout est en ligne/.test(document.getElementById('screen-monsite').innerText),
        pastille: (document.getElementById('chipEtat') || {}).textContent,
      };
    });
    ok('coquille : plus de sidebar, de nav du bas, d’écran Accueil, d’ancienne barre mobile', !r.sidebar && !r.navBas && !r.dashboard && !r.topbarM, JSON.stringify(r));
    ok('coquille : barre haute visible avec le logo LeLab', r.barre && r.logo, JSON.stringify(r));
    ok('coquille : « Mon site » est l’écran d’accueil', r.monsiteActif);
    ok('coquille : « Le reste du site, c’est nous. »', r.reste);
    ok('coquille : « Demander au studio » → mailto:contact@lestudmarseille.fr', r.mail && r.mail.startsWith('mailto:contact@lestudmarseille.fr'), r.mail);
    ok('coquille : aucune trace d’Instagram ni de LeLab+', !r.insta && !r.plus, JSON.stringify(r));
    ok('accueil : pas de bouton « Tout est en ligne » ; l’état est dans la pastille « En ligne »', !r.boutonAccueil && !r.toutEnLigne && r.pastille === 'En ligne', JSON.stringify([r.boutonAccueil, r.toutEnLigne, r.pastille]));
    await p.close();
  }
  ok('aucune requête vers une fonction Instagram, le studio ou Blobs', !requetes.some(u => /instagram|caption|upload-image|serve-image|moteur/i.test(u)), requetes.filter(u => /instagram|caption|upload|serve|moteur/i.test(u)).join(', '));

  await b.close();
  console.log(`\n${total - echecs}/${total} vérifications passées`);
  process.exit(echecs ? 1 : 0);
})();
