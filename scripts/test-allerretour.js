/* ============================================================
   Admin LeLab santé — test d'ALLER-RETOUR NEUTRE + garde-fous d'écriture.
   Usage :  python3 -m http.server 8765   (à la racine du dépôt)
            node scripts/test-allerretour.js [http://localhost:8765]
   Nécessite puppeteer-core (pris dans ../lestud-template-food/node_modules
   à défaut d'installation locale) et Google Chrome.

   L'appel à save-data est INTERCEPTÉ : rien n'est écrit, nulle part.
   Le corps qui serait envoyé est comparé, à l'octet, à ce que save-data
   écrirait (JSON.stringify(data, null, 2) + '\n').
   ============================================================ */
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const RACINE = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fichier = f => fs.readFileSync(path.join(RACINE, '_data', f + '.json'), 'utf8');
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
    p.on('request', r => {
      if (r.url().includes('/.netlify/functions/save-data')){
        envois.push(JSON.parse(r.postData()));
        return r.respond({ status: reponse.status, contentType: 'application/json', body: reponse.body });
      }
      r.continue();
    });
    p.on('pageerror', e => ok('aucune erreur JS', false, e.message));
    await p.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });   // localhost → bypass dev → boot()
    await p.evaluate(() => { session = { access_token: 'test', refresh_token: 'test', expires_at: Date.now() + 3600e3 }; });
  }
  const ouvrirEdition = edit => p.evaluate(e => openEdit(toutesLesCartes().find(c => c.edit === e)), edit);
  const publierEtAttendre = async () => { const n = envois.length; await p.evaluate(() => publier()); await new Promise(r => setTimeout(r, 150)); return envois.length > n ? envois[envois.length - 1] : null; };
  const boutonActif = () => p.evaluate(() => !document.getElementById('btnPublier').disabled);
  const saisir = (sel, val) => p.evaluate((s, v) => { const n = document.querySelectorAll('#editCorps ' + s)[0]; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, sel, val);
  const saisirN = (sel, i, val) => p.evaluate((s, k, v) => { const n = document.querySelectorAll('#editCorps ' + s)[k]; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, sel, i, val);

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
    env && JSON.stringify(Object.keys(env.data)) === '["avant","accueil","apres"]' && JSON.stringify(Object.keys(env.data.accueil[1])) === '["id","texte","fort","note"]', JSON.stringify(env && env.data));
  await ouvrirEdition('coordonnees'); env = await publierEtAttendre();
  ok('coordonnees : clé inconnue d’un site conservée', env && env.data.sites[0].horaires === 'garde-moi');

  /* 3. Modifications réelles. */
  await ouvrir(); await ouvrirEdition('accueil');
  await saisirN('textarea', 1, 'Confidentialité garantie.');
  ok('textes : une saisie active le bouton', await boutonActif());
  env = await publierEtAttendre();
  const orig = JSON.parse(fichier('textes'));
  ok('textes : seul le paragraphe 2 change', env && env.data.accueil[1].texte === 'Confidentialité garantie.' && env.data.accueil[1].fort === true
     && env.data.accueil[0].texte === orig.accueil[0].texte && env.data.accueil[2].texte === orig.accueil[2].texte, JSON.stringify(env && env.data));
  await new Promise(r => setTimeout(r, 1400));
  ok('après 200 : retour automatique sur « Mon site »', await p.evaluate(() => document.getElementById('screen-monsite').classList.contains('active')));
  ok('après 200 : la mémoire porte l’état écrit (pas de relecture du CDN)', await p.evaluate(() => donnees.textes.accueil[1].texte === 'Confidentialité garantie.'));

  await ouvrir(); await ouvrirEdition('accueil');
  await saisirN('textarea', 0, '   ');
  env = await publierEtAttendre();
  ok('textes : paragraphe vide → refusé, rien envoyé', env === null);

  await ouvrir(); await ouvrirEdition('coordonnees');
  await saisirN('input[type=tel]', 1, '06 12 34 56 78');
  env = await publierEtAttendre();
  ok('coordonnees : téléphone d’Aix modifié, Marseille intact', env && env.data.sites[1].telephone === '06 12 34 56 78' && env.data.sites[0].telephone === '04 91 50 01 13');
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
  for (const [nom, sel, i, val] of [['titre', 'input[type=text]', 1, 'Fermeture exceptionnelle'], ['texte', 'textarea', 0, 'Fermé **lundi**.'], ['date de fin', 'input[type=date]', 1, '2026-12-31']]){
    await ouvrir(); await ouvrirEdition('message');
    await saisirN(sel, i, val);
    env = await publierEtAttendre();
    ok(`message : changer le ${nom} régénère l’id`, env && env.data.id !== info.id && /^msg-/.test(env.data.id), env && env.data.id);
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
