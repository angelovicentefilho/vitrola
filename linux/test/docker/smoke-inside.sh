#!/usr/bin/env bash
# Roda dentro do contêiner (chamado por linux/test/smoke.sh), já com D-Bus e Xvfb.
set -uo pipefail

LOG="$(mktemp)"
FAILED=0

check() {   # check "descrição" padrão
    if grep -q -- "$2" "$LOG"; then
        echo "  ✓ $1"
    else
        echo "  ✗ $1 (não achei \"$2\" no log)"
        FAILED=1
    fi
}

echo "→ Abrindo a Vitrola por 60 s…"
VITROLA_DEBUG=1 timeout 60 gjs -m linux/app/src/main.js >"$LOG" 2>&1
echo "→ Verificações:"
check "a janela do YouTube Music foi criada" "vitrola: janela criada"
check "a página music.youtube.com carregou" "vitrola: carregou https://music.youtube.com"
check "o JavaScript da página respondeu" "vitrola: título da página: "
if [[ -s "$HOME/.local/share/vitrola/webkit/cookies.sqlite" ]]; then
    echo "  ✓ os cookies ficam salvos em ~/.local/share/vitrola/webkit"
else
    echo "  ✗ não achei ~/.local/share/vitrola/webkit/cookies.sqlite"
    FAILED=1
fi

if [[ $FAILED -ne 0 ]]; then
    echo "→ Log completo:"
    cat "$LOG"
    exit 1
fi
echo "✓ Tudo certo"
