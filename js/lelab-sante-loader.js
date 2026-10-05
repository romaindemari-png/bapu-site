/* ============================================================
   LeLab santé — loader de contenus
   Lit _data/*.json et les injecte dans la page par marqueurs cms-*.
   GÉNÉRIQUE FAMILLE SANTÉ : aucune valeur client ici. Les contenus
   vivent dans _data/, les emplacements dans le HTML du site.

   Pattern repris du loader food (lestud-template-food, lelab-cms-loader.js) :
   injection par id / par classe, une classe = tous les emplacements d'un champ.

   Marqueurs (posés dans le HTML) :
     #cms-texte-<cle>        conteneur : ses <p> sont remplacés par textes.<cle>[]
     .cms-tel-<site>         texte = coordonnees.sites[cle=<site>].telephone
     .cms-tellink-<site>     href  = tel: dérivé du téléphone
     .cms-adr-<site>         adresse, lignes séparées par <br>
     .cms-adrl-<site>        adresse sur une ligne (lignes jointes par une espace)

   ⚠️ Rien que du TEXTE et des href : jamais innerHTML (le contenu vient de
      l'admin), jamais de classe de layout ni de reveal touchée.
   ⚠️ JSON absent / illisible / champ vide → le HTML statique reste tel quel.
      Ce n'est pas un repli qui masque une panne : c'est le même contenu,
      et l'échec est signalé en console.
   ============================================================ */
(function () {
  'use strict';

  function loadJSON(path) {
    return fetch(path)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { console.warn('[LeLab] Impossible de charger ' + path, e); return null; });
  }

  function each(selector, fn) {
    document.querySelectorAll(selector).forEach(fn);
  }

  /* Numéro affiché → href tel:. 0X XX XX XX XX → +33… ; +… conservé. */
  function telHref(num) {
    var chiffres = String(num).replace(/\D/g, '');
    if (/^0\d{9}$/.test(chiffres)) return 'tel:+33' + chiffres.slice(1);
    if (/^\s*\+/.test(num) && chiffres.length >= 8) return 'tel:+' + chiffres;
    return null;
  }

  function nonVide(v) { return typeof v === 'string' && v.trim() !== ''; }

  function appliquerTextes(textes) {
    if (!textes || typeof textes !== 'object') return;
    Object.keys(textes).forEach(function (cle) {
      var paras = textes[cle];
      var bloc = document.getElementById('cms-texte-' + cle);
      if (!bloc || !Array.isArray(paras)) return;
      paras = paras.filter(function (p) { return p && nonVide(p.texte); });
      if (!paras.length) return;
      bloc.querySelectorAll(':scope > p').forEach(function (p) { p.remove(); });
      paras.forEach(function (p) {
        var el = document.createElement('p');
        if (p.fort) {
          var s = document.createElement('strong');
          s.textContent = p.texte;
          el.appendChild(s);
        } else {
          el.textContent = p.texte;
        }
        bloc.appendChild(el);
      });
    });
  }

  function appliquerCoordonnees(coord) {
    var sites = coord && Array.isArray(coord.sites) ? coord.sites : [];
    sites.forEach(function (s) {
      if (!s || !nonVide(s.cle)) return;
      var cle = s.cle;

      if (nonVide(s.telephone)) {
        var href = telHref(s.telephone);
        each('.cms-tel-' + cle, function (el) { el.textContent = s.telephone; });
        if (href) each('.cms-tellink-' + cle, function (el) { el.setAttribute('href', href); });
        else console.warn('[LeLab] Téléphone non reconnu (' + cle + ') : lien d\'appel laissé tel quel');
      }

      var lignes = Array.isArray(s.adresse) ? s.adresse.filter(nonVide) : [];
      if (lignes.length) {
        each('.cms-adr-' + cle, function (el) {
          el.textContent = '';
          lignes.forEach(function (l, i) {
            if (i) el.appendChild(document.createElement('br'));
            el.appendChild(document.createTextNode(l));
          });
        });
        each('.cms-adrl-' + cle, function (el) { el.textContent = lignes.join(' '); });
      }
    });
  }

  Promise.all([loadJSON('/_data/textes.json'), loadJSON('/_data/coordonnees.json')])
    .then(function (r) {
      appliquerTextes(r[0]);
      appliquerCoordonnees(r[1]);
    });
})();
