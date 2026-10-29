/* ============================================================
   Tuiles de grain PRÉ-CALCULÉES pour le pied de Publier (29/10).
   Usage :  python3 -m http.server <port>   puis   node scripts/gen-grain-pied.js <port>

   Le pied est un groupe isolé (sticky + z-index) : un calque en mix-blend-mode:soft-light n'y voit
   que le pied lui-même (verre presque transparent) et peint le gris brut de la tuile (mesuré : la
   luminance moyenne sous le pied passait de 36 à 70 la nuit). On calcule donc à l'avance, pour chaque
   chromie, ce que fait le grain de la page sur --fond :  P = softlight(--fond, g)  (W3C Compositing 1),
   et on l'écrit avec un alpha de .55 (l'opacité de .grain-fond). Posé en mélange NORMAL :
       --fond × (1 − .55) + P × .55   =   exactement la formule du grain de la page sur --fond.
   Même tuile source que la page : grain-sombre.png la nuit, grain.png le jour.
   ============================================================ */
const fs = require('fs'), path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(__dirname, '../../lestud-template-food/node_modules/puppeteer-core')); }
const PORT = process.argv[2] || '8765';
const CIBLES = [['nuit', 'grain-sombre.png', '#1A1526'], ['jour', 'grain.png', '#CAB4FF']];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage();
  await p.goto(`http://localhost:${PORT}/admin/charte.html`);
  for (const [chromie, source, fond] of CIBLES){
    const b64 = await p.evaluate(async (src, fond) => {
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height);
      const F = fond.match(/[0-9a-f]{2}/gi).map(h => parseInt(h, 16) / 255);
      const sl = (cb, cs) => cs <= .5 ? cb - (1 - 2 * cs) * cb * (1 - cb)
                                     : cb + (2 * cs - 1) * ((cb <= .25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb)) - cb);
      for (let i = 0; i < d.data.length; i += 4){
        const g = d.data[i] / 255;
        for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(sl(F[k], g) * 255);
        d.data[i + 3] = Math.round(.55 * 255);
      }
      x.putImageData(d, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    }, '/admin/assets/' + source, fond);
    const f = path.join(__dirname, '..', 'admin', 'assets', 'grain-pied-' + chromie + '.png');
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log(f, fs.statSync(f).size, 'o');
  }
  await b.close();
})();
