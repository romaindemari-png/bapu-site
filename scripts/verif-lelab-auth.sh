#!/bin/sh
# Vérifie que admin/lelab-auth.js contient À L'OCTET les blocs du master LeLab qu'il déclare.
# Usage : sh scripts/verif-lelab-auth.sh [chemin du dépôt lestud-template-food]
# Lit les marqueurs « @@ master admin/index.html L<a>-<b> @<commit> » du fichier, extrait les mêmes
# lignes du master à ce commit, et compare. Sortie non nulle au moindre octet de différence.
set -e
MASTER="${1:-$(dirname "$0")/../../lestud-template-food}"
FICHIER="$(dirname "$0")/../admin/lelab-auth.js"
ok=0; ko=0
for m in $(grep -o '@@ master admin/index.html L[0-9]*-[0-9]* @[0-9a-f]*' "$FICHIER" | sed 's/.*L\([0-9]*\)-\([0-9]*\) @\([0-9a-f]*\)/\1:\2:\3/'); do
  a=${m%%:*}; r=${m#*:}; b=${r%%:*}; c=${r#*:}
  attendu=$(git -C "$MASTER" show "$c:admin/index.html" | sed -n "${a},${b}p")
  # bloc présent dans le fichier : lignes entre le marqueur et le marqueur de fin correspondant
  present=$(awk -v t="@@ master admin/index.html L$a-$b @$c" 'index($0,t){on=1;next} on&&index($0,"@@ fin L'"$a-$b"'"){exit} on' "$FICHIER")
  if [ "$attendu" = "$present" ]; then echo "✓ L$a-$b @$c identique"; ok=$((ok+1)); else echo "✗ L$a-$b @$c DIFFÉRENT"; ko=$((ko+1)); fi
done
[ $ok -gt 0 ] || { echo "✗ aucun bloc trouvé — vérification cassée"; exit 1; }
[ $ko -eq 0 ]
