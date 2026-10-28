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
édition coordonnées|/admin/|openEdit(toutesLesCartes().find(c => c.edit === 'coordonnees'))
édition message|/admin/|$MSG
quitter sans publier|/admin/|$MSG; const i = document.querySelector('#editCorps input[type=text]'); i.value = i.value + ' x'; signalerSaisie(); document.querySelector('.retour').click()
connexion|/admin/|document.body.classList.remove('authed')
LISTE
done
[ $ko -eq 0 ] && echo "✅ toutes les mesures passent" || { echo "❌ $ko mesure(s) en échec"; exit 1; }
