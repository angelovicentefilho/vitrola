#!/usr/bin/env bash
# Roda dentro do contêiner (chamado por linux/test/smoke.sh), já com D-Bus e Xvfb.
#   smoke-inside.sh normal   → abre, lê o estado, derruba o processo da página e confere a recuperação
#   smoke-inside.sh offline  → abre sem rede (o smoke.sh religa a rede depois de ~15 s)
set -uo pipefail

SCENARIO="${1:-normal}"
LOG="$(mktemp)"
FAILED=0

check() {   # check "descrição" padrão [ocorrências mínimas]
    local count
    count="$(grep -c -- "$2" "$LOG" || true)"
    if (( count >= ${3:-1} )); then
        echo "  ✓ $1"
    else
        echo "  ✗ $1 (esperava \"$2\" no log ${3:-1}x, achei ${count}x)"
        FAILED=1
    fi
}

wait_for() {   # wait_for padrão segundos
    for _ in $(seq "$2"); do
        grep -q -- "$1" "$LOG" && return 0
        sleep 1
    done
    return 1
}

start_app() {
    VITROLA_DEBUG=1 gjs -m linux/app/src/main.js "$@" >"$LOG" 2>&1 &
    APP_PID=$!
}

stop_app() {
    kill "$APP_PID" 2>/dev/null
    wait "$APP_PID" 2>/dev/null
}

case "$SCENARIO" in
normal)
    echo "→ Cenário: abrir, ler o estado, instância única e sobreviver à queda da página"
    start_app --em-segundo-plano
    wait_for "vitrola: carregou https://music.youtube.com" 40
    wait_for "vitrola: estado: " 15
    # Segunda execução: repassa para a primeira e sai.
    VITROLA_DEBUG=1 timeout 15 gjs -m linux/app/src/main.js >/dev/null 2>&1
    SECOND_STATUS=$?
    wait_for "vitrola: mostrando a janela" 5
    pkill -f WebKitWebProcess
    wait_for "processo da página caiu" 10
    sleep 15
    stop_app
    check "a janela do YouTube Music foi criada" "vitrola: janela criada"
    check "--em-segundo-plano inicia sem mostrar a janela" "vitrola: iniciou em segundo plano"
    check "rodar de novo mostra a janela da instância existente" "vitrola: mostrando a janela"
    if [[ "$SECOND_STATUS" == "0" && "$(grep -c 'vitrola: janela criada' "$LOG")" == "1" ]]; then
        echo "  ✓ a segunda execução saiu sem criar outro player"
    else
        echo "  ✗ a segunda execução não se comportou como instância única (saída $SECOND_STATUS)"
        FAILED=1
    fi
    check "a página music.youtube.com carregou" "vitrola: carregou https://music.youtube.com"
    check "o estado do player foi lido (sem login: nada tocando)" "vitrola: estado: idle"
    check "a queda do processo da página foi detectada" "vitrola: processo da página caiu"
    check "a página recarregou depois da queda" "vitrola: carregou https://music.youtube.com" 2
    if [[ -s "$HOME/.local/share/vitrola/webkit/cookies.sqlite" ]]; then
        echo "  ✓ os cookies ficam salvos em ~/.local/share/vitrola/webkit"
    else
        echo "  ✗ não achei ~/.local/share/vitrola/webkit/cookies.sqlite"
        FAILED=1
    fi
    ;;
offline)
    echo "→ Cenário: abrir sem internet e carregar quando a rede voltar"
    sleep 3     # dá tempo ao smoke.sh de desligar a rede
    start_app
    wait_for "vitrola: carregou https://music.youtube.com" 45
    stop_app
    check "o primeiro carregamento falhou sem rede" "vitrola: falhou ao carregar"
    check "a Vitrola agendou nova tentativa" "vitrola: tentando de novo em 5 s"
    check "a página carregou quando a rede voltou" "vitrola: carregou https://music.youtube.com"
    ;;
*)
    echo "cenário desconhecido: $SCENARIO"
    exit 2
    ;;
esac

if [[ $FAILED -ne 0 ]]; then
    echo "→ Log completo:"
    cat "$LOG"
    exit 1
fi
echo "  ✓ cenário $SCENARIO ok"
