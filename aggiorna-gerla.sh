#!/usr/bin/env bash
# ============================================================
#  Gerla — pubblica su GitHub i file scaricati da Claude
#  Uso: ./aggiorna-gerla.sh   (dalla cartella del deposito)
# ============================================================
set -u
DEPOSITO="$(cd "$(dirname "$0")" && pwd)"
SCARICATI="${1:-$HOME/Downloads}"

echo
echo "  GERLA — pubblicazione"
echo "  ---------------------"
echo "  deposito : $DEPOSITO"
echo "  scaricati: $SCARICATI"
echo

command -v git >/dev/null || { echo "  [!] Git non installato."; exit 1; }
cd "$DEPOSITO"
[ -d .git ] || { echo "  [!] Questa cartella non è un deposito Git."; exit 1; }

echo "  Prendo le novità già pubblicate…"
git pull --rebase --quiet || echo "  [!] Il pull ha segnalato un problema."

copiati=0
file_pubblicati=()
for f in gerla.html gerla-aggiorna.mjs gerla-skrimpers.mjs README.md GUIDA-PROPRIETARIO.md; do
  if [ -f "$SCARICATI/$f" ]; then cp -f "$SCARICATI/$f" "$DEPOSITO/$f"; echo "  + $f"; copiati=$((copiati+1)); file_pubblicati+=("$f"); fi
done
if [ -f "$SCARICATI/gerla-aggiorna.yml" ]; then
  mkdir -p "$DEPOSITO/.github/workflows"
  cp -f "$SCARICATI/gerla-aggiorna.yml" "$DEPOSITO/.github/workflows/gerla-aggiorna.yml"
  echo "  + gerla-aggiorna.yml  (in .github/workflows)"; copiati=$((copiati+1))
  file_pubblicati+=(".github/workflows/gerla-aggiorna.yml")
fi

[ "$copiati" -eq 0 ] && { echo; echo "  Nessun file nuovo in $SCARICATI."; echo "  (Il listino prezzi non si copia mai da qui: si aggiorna da solo ogni mattina.)"; exit 0; }

git add -- "${file_pubblicati[@]}"
if git diff --staged --quiet; then
  echo "  I file erano già identici: niente da inviare."
else
  git commit -m "Gerla: aggiornamento del $(date +%F)" --quiet
  echo "  Invio a GitHub…"
  git push --quiet || { echo "  [!] Invio non riuscito."; exit 1; }
  echo "  Fatto: il sito si aggiorna entro un paio di minuti."
fi

echo
read -r -p "  Vuoi lanciare subito l'aggiornamento dei prezzi? (s/n) " r
if [ "$r" = "s" ]; then
  if command -v gh >/dev/null; then gh workflow run "Aggiorna listino Gerla" && echo "  Flusso avviato."
  else echo "  Apri: https://github.com/krastaman85/gerla/actions e premi Run workflow"; fi
fi
echo
echo "  Ricorda: sul sito premi Ctrl+Maiusc+R (Cmd+Maiusc+R su Mac)."
