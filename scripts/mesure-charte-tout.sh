#!/bin/sh
# B1 — la charte mesurée partout : la page de contrôle et CHAQUE écran de l'admin, à 390 et à 1280 px.
# Usage : sh scripts/mesure-charte-tout.sh <port>   (serveur statique à la racine du dépôt)
# Sortie : une ligne par mesure, et le compte des ❌ ; code de sortie non nul au moindre échec.
P="${1:?port}"; D="$(dirname "$0")"; ko=0
MSG="openEdit(toutesLesCartes().find(c => c.edit === 'message'))"
for L in 390 1280; do
  while IFS='|' read -r nom page geste; do
    out=$(LARGEUR=$L node "$D/mesure-charte.js" "$P" "$page" body "$geste" 2>&1); code=$?
    n=$(printf '%s\n' "$out" | grep -c '❌')
    printf '%-5s %-28s %s ❌  %s\n' "$L" "$nom" "$n" "$( [ $code -eq 0 ] && echo ok || echo ÉCHEC)"
    [ $code -eq 0 ] || { ko=$((ko+1)); printf '%s\n' "$out" | grep '❌' | head -20; }
  done <<LISTE
charte.html|/admin/charte.html|
accueil (mon site)|/admin/|
volet compte|/admin/|basculerVoletCompte()
accueil pendant une publication|/admin/|window.__LELAB_TEMPS = 1; const p = debutPublication('coordonnees'); publicationEnvoyee(p, { ...donnees.coordonnees, x: 1 })
carte message à voir (terminé)|/admin/|donnees.info = { ...donnees.info, actif: true, dateDebut: '2026-01-01', dateFin: '2026-01-02' }; renderAccueil(); renderSiteCards()
carte message masquée|/admin/|donnees.info = { ...donnees.info, actif: false }; renderAccueil(); renderSiteCards()
carte message à jour (fenêtre)|/admin/|donnees.info = { ...donnees.info, actif: true, type: 'popup', dateDebut: '2026-01-01', dateFin: '2099-12-31' }; renderAccueil(); renderSiteCards()
édition coordonnées|/admin/|openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees'))
feuille : numéro invalide|/admin/|openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees')); const t = document.querySelector('#editCorps .f-champ[data-champ="standard"]'); t.value = '12 34'; t.dispatchEvent(new Event('input', { bubbles: true }))
édition modifiée (Publier)|/admin/|openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees')); const t = document.querySelectorAll('#editCorps input[type=tel]')[1]; t.value = '06 12 34 56 78'; t.dispatchEvent(new Event('input', { bubbles: true }))
édition envoyée (remplissage)|/admin/|window.__LELAB_TEMPS = 1; openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees')); const p = debutPublication('coordonnees'); publicationEnvoyee(p, donnees.coordonnees)
édition en ligne (jaune)|/admin/|openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees')); const p = debutPublication('coordonnees'); p.etat = 'envoye'; annoncerEnLigne(p)
feuille message : 2 points à corriger|/admin/|openEdit(toutesLesCartes().find(c => c.edit === 'message')); const t = document.querySelector('#editCorps .f-msg-titre'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); const d = document.querySelectorAll('#editCorps .f-date'); d[0].value = '2026-12-31'; d[1].value = '2026-12-01'; d[1].dispatchEvent(new Event('input', { bubbles: true }))
édition message|/admin/|$MSG
quitter sans publier|/admin/|$MSG; const i = document.querySelector('#editCorps input[type=text]'); i.value = i.value + ' x'; signalerSaisie(); document.querySelector('.retour').click()
connexion|/admin/|document.body.classList.remove('authed')
LISTE
done
[ $ko -eq 0 ] && echo "✅ toutes les mesures passent" || { echo "❌ $ko mesure(s) en échec"; exit 1; }
