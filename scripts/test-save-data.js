/* ============================================================
   save-data — garde « un aperçu n'écrit jamais » (B0b, 28/10/2026).
   Usage :  node scripts/test-save-data.js

   La fonction est appelée DIRECTEMENT (handler v1), avec un fetch
   SIMULÉ : chaque appel est enregistré, aucun ne sort de la machine.
   Une URL inattendue fait échouer la sonde au lieu de partir sur le réseau.

   1. Hôtes de prod (bapuaixmarseille.fr, www., bapu-site.netlify.app) :
      l'écriture passe — lecture de config, GET du fichier, PUT simulés.
   2. Hôtes à « -- » (Deploy Preview, branch deploy, permalink, main--) :
      403, et AUCUN appel (ni config, ni Git Gateway).
   3. Hôte absent ou vide : 403, aucun appel.
   ============================================================ */
const path = require('path');

process.env.URL = 'https://bapuaixmarseille.fr';
const GATEWAY = process.env.URL + '/.netlify/git/github/contents/_data/coordonnees.json';
const CONFIG = require(path.join(__dirname, 'fixtures', 'config.json'));

let appels = [];
global.fetch = async (url, opts = {}) => {
  const methode = (opts.method || 'GET').toUpperCase();
  appels.push(methode + ' ' + url);
  const rep = (status, corps) => ({ ok: status < 400, status, json: async () => corps, text: async () => JSON.stringify(corps) });
  if (url === process.env.URL + '/_data/config.json' && methode === 'GET') return rep(200, CONFIG);
  if (url === GATEWAY && methode === 'GET') return rep(200, { sha: 'sha-simule' });
  if (url === GATEWAY && methode === 'PUT') return rep(200, { content: {} });
  throw new Error('appel réseau inattendu : ' + methode + ' ' + url);
};

const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'save-data.js'));

let echecs = 0, total = 0;
function ok(nom, cond, detail){ total++; if (!cond) echecs++; console.log((cond ? '✓ ' : '✗ ') + nom + (cond || detail === undefined ? '' : '\n    → ' + detail)); }

const corps = JSON.stringify({ section: 'coordonnees', data: { sites: [], telephones: { standard: '04 91 50 01 13', portable: '07 57 01 47 03' } } });
async function appeler(headers){
  appels = [];
  const r = await handler({ httpMethod: 'POST', headers, body: corps });
  return { status: r.statusCode, body: r.body, appels: appels.slice() };
}

(async () => {
  for (const [nom, h] of [['bapuaixmarseille.fr', { host: 'bapuaixmarseille.fr' }],
                          ['www.bapuaixmarseille.fr', { host: 'www.bapuaixmarseille.fr' }],
                          ['bapu-site.netlify.app', { host: 'bapu-site.netlify.app' }],
                          ['en-tête « Host » en capitale', { Host: 'bapuaixmarseille.fr' }]]){
    const r = await appeler({ ...h, authorization: 'Bearer jeton-de-test' });
    const put = r.appels.filter(a => a.startsWith('PUT '));
    ok(`prod (${nom}) : écriture acceptée, un seul PUT simulé vers _data/coordonnees.json`,
      r.status === 200 && put.length === 1 && put[0] === 'PUT ' + GATEWAY, JSON.stringify(r));
  }

  for (const hote of ['deploy-preview-1--bapu-site.netlify.app', 'deploy-preview-12--bapu-site.netlify.app',
                      'b0-sondes-garde-apercu--bapu-site.netlify.app', 'main--bapu-site.netlify.app',
                      '6720f0c1a2b3c4d5e6f70809--bapu-site.netlify.app', 'DEPLOY-PREVIEW-1--BAPU-SITE.NETLIFY.APP']){
    const r = await appeler({ host: hote, authorization: 'Bearer jeton-de-test' });
    ok(`aperçu (${hote}) : 403, aucun appel`, r.status === 403 && r.appels.length === 0, JSON.stringify(r));
  }

  for (const [nom, h] of [['absent', {}], ['vide', { host: '' }], ['headers manquant', undefined]]){
    appels = [];
    const r = await handler({ httpMethod: 'POST', headers: h, body: corps });
    ok(`hôte ${nom} : 403, aucun appel`, r.statusCode === 403 && appels.length === 0, JSON.stringify({ status: r.statusCode, appels }));
  }

  /* La garde passe AVANT le jeton : un aperçu refuse même sans authentification (vérifiable au curl). */
  const r = await appeler({ host: 'deploy-preview-1--bapu-site.netlify.app' });
  ok('aperçu sans jeton : 403 (pas 401), aucun appel', r.status === 403 && r.appels.length === 0, JSON.stringify(r));

  console.log(`\n${total - echecs}/${total} vérifications passées`);
  process.exit(echecs ? 1 : 0);
})();
