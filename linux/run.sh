#!/usr/bin/env bash
# Roda a Vitrola direto do código, sem instalar.
#   ./run.sh              → abre a Vitrola
#   ./run.sh --debug      → idem, com mensagens de diagnóstico no terminal
set -euo pipefail
cd "$(dirname "$0")"

PACKAGES=(
    gjs
    gir1.2-gtk-4.0
    gir1.2-webkit-6.0
    gstreamer1.0-plugins-good
    gstreamer1.0-plugins-bad
    gstreamer1.0-libav
)

if command -v dpkg-query >/dev/null 2>&1; then
    missing=()
    for pkg in "${PACKAGES[@]}"; do
        status="$(dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null || true)"
        [[ "$status" == "install ok installed" ]] || missing+=("$pkg")
    done
    if (( ${#missing[@]} > 0 )); then
        echo "✗ Faltam pacotes para rodar a Vitrola: ${missing[*]}"
        echo "  Rode: sudo apt install ${missing[*]}"
        exit 1
    fi
elif ! command -v gjs >/dev/null 2>&1; then
    echo "✗ Não achei o gjs. A Vitrola para Linux foi feita para Ubuntu 24.04 ou mais novo."
    exit 1
fi

if [[ "${1:-}" == "--debug" ]]; then
    shift
    export VITROLA_DEBUG=1
fi

exec app/bin/vitrola "$@"
