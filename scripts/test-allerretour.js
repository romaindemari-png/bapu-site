/* ============================================================
   Admin LeLab santé — test d'ALLER-RETOUR NEUTRE + garde-fous d'écriture.
   Usage :  python3 -m http.server 8765   (à la racine du dépôt)
            node scripts/test-allerretour.js [http://localhost:8765]
   Nécessite puppeteer-core (pris dans ../lestud-template-food/node_modules
   à défaut d'installation locale) et Google Chrome.

   L'appel à save-data est INTERCEPTÉ : rien n'est écrit, nulle part.
   Le corps qui serait envoyé est comparé, à l'octet, à ce que save-data
   écrirait (JSON.stringify(data, null, 2) + '\n').

   ⚠️ DONNÉES GELÉES. Les /_data/*.json servis à la page sont les COPIES de
   scripts/fixtures/ (copiées de _data le 28/10), jamais les fichiers vivants :
   la cliente publie depuis l'admin, et une sonde qui lit _data change de
   résultat sans que le code ait bougé (constaté le 28/10 : son titre du 20/10
   valait la valeur de test « Fermeture exceptionnelle », l'id ne changeait plus).
   ============================================================ */
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const RACINE = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIXTURES = path.join(__dirname, 'fixtures');
const fichier = f => fs.readFileSync(path.join(FIXTURES, f + '.json'), 'utf8');
/* /_data/<f>.json → la copie gelée ; un fichier sans copie → 404, comme un fichier absent. */
function servirFixtures(page){
  page.on('request', r => {
    const m = new URL(r.url()).pathname.match(/^\/_data\/([a-z0-9-]+)\.json$/);
    if (!m) return;
    const f = path.join(FIXTURES, m[1] + '.json');
    if (fs.existsSync(f)) return r.respond({ status: 200, contentType: 'application/json', body: fs.readFileSync(f, 'utf8') });
    return r.respond({ status: 404, body: '' });
  });
}
const commeSaveData = data => JSON.stringify(data, null, 2) + '\n';

let echecs = 0, total = 0;
function ok(nom, cond, detail){ total++; if (!cond) echecs++; console.log((cond ? '✓ ' : '✗ ') + nom + (cond || detail === undefined ? '' : '\n    → ' + detail)); }

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  let p, envois, reponse;
  async function ouvrir(){
    if (p) await p.close();
    p = await b.newPage();
    envois = []; reponse = { status: 200, body: '{"success":true}' };
    await p.setRequestInterception(true);
    servirFixtures(p);
    p.on('request', r => {
      if (r.url().includes('/.netlify/functions/save-data')){
        envois.push(JSON.parse(r.postData()));
        return r.respond({ status: reponse.status, contentType: 'application/json', body: reponse.body });
      }
      if (new URL(r.url()).pathname.startsWith('/_data/')) return;   // déjà servi par servirFixtures
      r.continue();
    });
    p.on('pageerror', e => ok('aucune erreur JS', false, e.message));
    await p.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });   // localhost → bypass dev → boot()
    await p.evaluate(() => { session = { access_token: 'test', refresh_token: 'test', expires_at: Date.now() + 3600e3 }; });
    /* L'éditeur « textes » reste une brique générique santé, mais BAPU ne l'expose plus
       (config.json : bloc accueil sans admin.edit). Pour continuer à le tester, on le
       réactive EN MÉMOIRE de la page de test — jamais dans les fichiers. */
    await p.evaluate(async () => {
      const a = donnees.config.blocs.socle.accueil && donnees.config.blocs.socle.accueil.admin;
      if (a && !a.edit){ a.edit = 'accueil'; donnees.textes = await _json('textes'); }
    });
  }
  const ouvrirEdition = edit => p.evaluate(e => openEdit(toutesLesCartes().find(c => c.edit === e)), edit);
  const publierEtAttendre = async () => { const n = envois.length; await p.evaluate(() => publier()); await new Promise(r => setTimeout(r, 150)); return envois.length > n ? envois[envois.length - 1] : null; };
  const boutonActif = () => p.evaluate(() => !document.getElementById('btnPublier').disabled);
  const saisir = (sel, val) => p.evaluate((s, v) => { const n = document.querySelectorAll('#editCorps ' + s)[0]; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, sel, val);
  const saisirN = (sel, i, val) => p.evaluate((s, k, v) => { const n = document.querySelectorAll('#editCorps ' + s)[k]; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, sel, i, val);

  /* 0. Configuration BAPU telle que publiée : textes d'accueil NON éditables. */
  {
    const q = await b.newPage();
    await q.setRequestInterception(true);
    servirFixtures(q);
    q.on('request', r => { if (!new URL(r.url()).pathname.startsWith('/_data/')) r.continue(); });
    await q.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });
    const r = await q.evaluate(() => ({ cartes: toutesLesCartes().map(c => c.edit), dom: [...document.querySelectorAll('#siteCards .card')].map(c => c.dataset.edit), textesLu: 'textes' in etatDonnees }));
    ok('config BAPU : aucune carte « accueil » (ni dans la config lue, ni à l’écran)', !r.cartes.includes('accueil') && !r.dom.includes('accueil') && r.dom.length === 2, JSON.stringify(r));
    ok('config BAPU : textes.json n’est même plus chargé par l’admin', !r.textesLu, JSON.stringify(r));
    await q.close();
  }

  /* 1. ALLER-RETOUR NEUTRE — ouvrir, publier sans rien changer : octet pour octet. */
  for (const [edit, f] of [['accueil', 'textes'], ['coordonnees', 'coordonnees'], ['message', 'info']]){
    await ouvrir(); await ouvrirEdition(edit);
    ok(`${edit} : bouton Publier inactif tant que rien n'a changé`, !(await boutonActif()));
    const env = await publierEtAttendre();
    ok(`${edit} : aller-retour neutre identique à l'octet (_data/${f}.json)`, env && env.section === edit && commeSaveData(env.data) === fichier(f),
      env ? commeSaveData(env.data) : 'aucun envoi');
  }

  /* 2. Clés inconnues restituées telles quelles, à leur place. */
  await ouvrir();
  await p.evaluate(() => { donnees.textes = { avant: 1, ...donnees.textes, apres: { x: 1 } }; donnees.textes.accueil[1] = { id: 'p2', ...donnees.textes.accueil[1], note: 'n' };
                           donnees.coordonnees.sites[0].horaires = 'garde-moi'; });
  await ouvrirEdition('accueil');
  let env = await publierEtAttendre();
  ok('textes : clés inconnues (racine et paragraphe) conservées, ordre compris',
    env && JSON.stringify(Object.keys(env.data)) === '["avant","accueil","apres"]' && JSON.stringify(Object.keys(env.data.accueil[1])) === '["id","texte","fort","role","note"]', JSON.stringify(env && env.data));
  await ouvrirEdition('coordonnees'); env = await publierEtAttendre();
  ok('coordonnees : clé inconnue d’un site conservée', env && env.data.sites[0].horaires === 'garde-moi');

  /* 2 bis. Le libellé suit le RÔLE du texte (textes.json → role), pas sa position. */
  const libelles = () => p.evaluate(() => [...document.querySelectorAll('#editCorps .ed-num')].map(n => n.textContent));
  await ouvrir(); await ouvrirEdition('accueil');
  await p.evaluate(() => document.querySelectorAll('#editCorps .ed-suppr')[1].click());
  env = await publierEtAttendre();
  ok('textes : suppression du 2e → les rôles restants voyagent avec leur texte',
    env && JSON.stringify(env.data.accueil.map(x => x.role)) === '["prise-de-rendez-vous","delai"]', JSON.stringify(env && env.data));
  await ouvrir();
  await p.evaluate(d => { donnees.textes = d; }, env ? env.data : null);
  await ouvrirEdition('accueil');
  ok('textes : réouverture après suppression → chaque libellé reste sur son texte',
    JSON.stringify(await libelles()) === '["Comment prendre rendez-vous","Délai de rendez-vous"]', JSON.stringify(await libelles()));

  /* 2 ter. Fichier non migré (paragraphes sans role) : toléré, numéroté, réécrit tel quel. */
  await ouvrir();
  const sansRole = { accueil: JSON.parse(fichier('textes')).accueil.map(({ role, ...x }) => x) };
  await p.evaluate(d => { donnees.textes = d; }, sansRole);
  await ouvrirEdition('accueil');
  ok('textes sans role : numérotation en secours',
    JSON.stringify(await libelles()) === '["1er paragraphe","2e paragraphe","3e paragraphe"]', JSON.stringify(await libelles()));
  env = await publierEtAttendre();
  ok('textes sans role : aller-retour neutre identique à l’octet (aucun role ajouté)',
    env && commeSaveData(env.data) === commeSaveData(sansRole), env ? commeSaveData(env.data) : 'aucun envoi');

  /* 3. Modifications réelles. */
  await ouvrir(); await ouvrirEdition('accueil');
  await saisirN('textarea', 1, 'Confidentialité garantie.');
  ok('textes : une saisie active le bouton', await boutonActif());
  env = await publierEtAttendre();
  const orig = JSON.parse(fichier('textes'));
  ok('textes : seul le paragraphe 2 change', env && env.data.accueil[1].texte === 'Confidentialité garantie.' && env.data.accueil[1].fort === true
     && env.data.accueil[0].texte === orig.accueil[0].texte && env.data.accueil[2].texte === orig.accueil[2].texte, JSON.stringify(env && env.data));
  await new Promise(r => setTimeout(r, 1400));
  /* B4 (28/10) : plus de fermeture automatique à 1,2 s — l'éditeur reste ouvert, la preuve « en ligne » suit (test-publier). */
  ok('après 200 : on reste sur l’éditeur (plus de fermeture à 1,2 s)', await p.evaluate(() => document.getElementById('screen-edit').classList.contains('active')));
  ok('après 200 : la mémoire porte l’état écrit (pas de relecture du CDN)', await p.evaluate(() => donnees.textes.accueil[1].texte === 'Confidentialité garantie.'));

  await ouvrir(); await ouvrirEdition('accueil');
  await saisirN('textarea', 0, '   ');
  env = await publierEtAttendre();
  ok('textes : paragraphe vide → refusé, rien envoyé', env === null);

  /* Numéros COMMUNS aux deux sites (telephones.standard / .portable, depuis le 23/10) : les sites
     n'ont plus de `telephone`, les deux seuls champs tél. sont standard (0) puis portable (1). */
  const coord = JSON.parse(fichier('coordonnees'));
  for (const [type, i, autre] of [['portable', 1, 'standard'], ['standard', 0, 'portable']]){
    await ouvrir(); await ouvrirEdition('coordonnees');
    await saisirN('input[type=tel]', i, '06 12 34 56 78');
    env = await publierEtAttendre();
    ok(`coordonnees : numéro ${type} modifié, ${autre} et adresses intacts, aucun téléphone ajouté aux sites`,
      coord.telephones[type] !== '06 12 34 56 78' && env && env.data.telephones[type] === '06 12 34 56 78'
      && env.data.telephones[autre] === coord.telephones[autre]
      && JSON.stringify(env.data.sites) === JSON.stringify(coord.sites), JSON.stringify(env && env.data));
  }
  await saisirN('input[type=tel]', 0, '12 34');
  env = await publierEtAttendre();
  ok('coordonnees : téléphone invalide → refusé, rien envoyé', env === null);
  await ouvrir(); await ouvrirEdition('coordonnees');
  await saisirN('input[type=text]', 1, '');
  env = await publierEtAttendre();
  ok('coordonnees : ligne d’adresse vidée → retirée du tableau', env && JSON.stringify(env.data.sites[0].adresse) === '["93 Bd Camille Flammarion,"]', JSON.stringify(env && env.data.sites[0]));

  /* 4. Message : régénération de l'id. */
  const info = JSON.parse(fichier('info'));
  await ouvrir(); await ouvrirEdition('message');
  await p.evaluate(() => { const c = document.querySelectorAll('#editCorps input[type=checkbox]'); c[c.length - 1].click(); });   // urgences
  env = await publierEtAttendre();
  ok('message : basculer les urgences ne change PAS l’id', env && env.data.id === info.id && env.data.urgences === !info.urgences);
  /* Chaque valeur DIFFÈRE de la copie gelée (contrôlé ci-dessous) : sinon rien ne change et l'id
     reste, à raison — c'est ce qui faisait échouer la sonde quand elle lisait _data. */
  for (const [nom, cle, sel, i, val] of [['titre', 'titre', 'input[type=text]', 1, 'Titre de sonde'], ['texte', 'texte', 'textarea', 0, 'Fermé **lundi**.'], ['date de fin', 'dateFin', 'input[type=date]', 1, '2026-12-31']]){
    await ouvrir(); await ouvrirEdition('message');
    await saisirN(sel, i, val);
    env = await publierEtAttendre();
    ok(`message : changer le ${nom} régénère l’id`, info[cle] !== val && env && env.data.id !== info.id && /^msg-/.test(env.data.id),
      'copie : ' + info[cle] + ' · id envoyé : ' + (env && env.data.id));
  }
  await ouvrir(); await ouvrirEdition('message');
  await saisirN('textarea', 0, 'Ligne 1\nFermé **lundi** <img src=x>');
  env = await publierEtAttendre();
  ok('message : **gras** → <strong>, retour à la ligne → <br>, le reste tel quel', env && env.data.texte === 'Ligne 1<br>Fermé <strong>lundi</strong> <img src=x>', env && env.data.texte);
  ok('message : memoriser conservé, ordre des clés conservé', env && env.data.memoriser === true && JSON.stringify(Object.keys(env.data)) === JSON.stringify(Object.keys(info)));
  await ouvrir(); await ouvrirEdition('message');
  await saisirN('input[type=date]', 0, '2026-12-31'); await saisirN('input[type=date]', 1, '2026-12-01');
  env = await publierEtAttendre();
  ok('message : fin avant début → refusé, rien envoyé', env === null);
  await ouvrir(); await ouvrirEdition('message');
  await p.evaluate(() => { const a = document.querySelector('#editCorps input[type=checkbox]'); if (!a.checked) a.click(); });   // indépendant de l'état publié
  await saisirN('input[type=text]', 1, '');
  env = await publierEtAttendre();
  ok('message : actif sans titre → refusé, rien envoyé', env === null);

  /* 5. Garde de lecture : fichier illisible → ni ouverture ni écriture. */
  await ouvrir();
  await p.evaluate(() => { etatDonnees.textes = 'erreur'; });
  await ouvrirEdition('accueil');
  ok('lecture en panne : l’éditeur ne s’ouvre pas', !(await p.evaluate(() => document.getElementById('screen-edit').classList.contains('active'))));

  /* 6. Échec serveur : rien n'est perdu, on peut réessayer. */
  await ouvrir(); await ouvrirEdition('accueil');
  await saisirN('textarea', 0, 'Nouveau texte');
  reponse = { status: 500, body: '{"error":"Écriture GitHub échouée"}' };
  env = await publierEtAttendre();
  const apres = await p.evaluate(() => ({ actif: !document.getElementById('btnPublier').disabled, sale: edition && edition.sale, ecran: document.getElementById('screen-edit').classList.contains('active'), mem: donnees.textes.accueil[0].texte }));
  ok('échec 500 : on reste sur l’écran, bouton réactivé, saisie gardée, mémoire inchangée', env && apres.actif && apres.sale && apres.ecran && apres.mem !== 'Nouveau texte', JSON.stringify(apres));

  /* 7. Quitter un écran modifié demande confirmation. */
  await p.click('.retour');
  ok('modifié + retour → confirmation affichée', await p.evaluate(() => !document.getElementById('quitter').hidden));
  await p.evaluate(() => confirmerQuitter(false));
  ok('« Rester » → toujours sur l’écran, saisie intacte', await p.evaluate(() => document.getElementById('screen-edit').classList.contains('active') && document.querySelector('#editCorps textarea').value === 'Nouveau texte'));
  await p.click('.retour'); await p.evaluate(() => confirmerQuitter(true));
  ok('« Quitter » → retour à « Mon site »', await p.evaluate(() => document.getElementById('screen-monsite').classList.contains('active')));

  await b.close();
  console.log(`\n${total - echecs}/${total} vérifications passées`);
  process.exit(echecs ? 1 : 0);
})();
