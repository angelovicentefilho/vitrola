#!/usr/bin/env bash
# Integração no contêiner (chamado por linux/test/smoke.sh): PulseAudio com duas saídas virtuais,
# testes unitários do GJS, uma faixa tocando de verdade e o app controlado pelo D-Bus
# (interface privada e MPRIS via playerctl).
set -uo pipefail

export XDG_RUNTIME_DIR=/tmp/run
mkdir -p -m 700 "$XDG_RUNTIME_DIR"
pulseaudio -D --exit-idle-time=-1 2>/dev/null
sleep 1
pactl load-module module-null-sink sink_name=fone sink_properties=device.description=Fone >/dev/null
pactl load-module module-null-sink sink_name=tv sink_properties=device.description=TV >/dev/null

FAILED=0
ok() { echo "  ✓ $1"; }
ko() { echo "  ✗ $1"; FAILED=1; }
expect() {   # expect "descrição" valor-obtido padrão-esperado
    if [[ "$2" == $3 ]]; then ok "$1"; else ko "$1 (obtido: $2)"; fi
}

echo "→ Testes unitários no GJS"
if VITROLA_TESTE_AUDIO=1 gjs -m linux/test/unit/run-gjs.js >/tmp/unit.log 2>&1; then
    ok "$(tail -1 /tmp/unit.log)"
else
    ko "testes unitários do GJS"; cat /tmp/unit.log
fi

echo "→ Integração: tocar uma faixa e controlar pelo D-Bus"
LOG=/tmp/app.log
VITROLA_DEBUG=1 gjs -m linux/app/src/main.js --em-segundo-plano >"$LOG" 2>&1 &
APP=$!
for _ in $(seq 45); do grep -q "estado: idle" "$LOG" && break; sleep 1; done

V="gdbus call --session --dest io.github.vitrola.Vitrola --object-path /io/github/vitrola/Vitrola --method io.github.vitrola.Vitrola"
P="playerctl -p vitrola"

expect "GetState responde com JSON" "$($V.GetState)" "*\"status\":\"idle\"*"
expect "GetMenu lista as saídas de áudio" "$($V.GetMenu)" "*Saída de áudio: *\"audio:fone\"*\"audio:tv\"*"
expect "comando desconhecido é recusado" "$($V.Command '{"name":"rodarJS"}')" "(false,)"

$V.ActivateMenuItem 'size:large' >/dev/null
$V.ActivateMenuItem 'toggle:autostart' >/dev/null
$V.ActivateMenuItem 'audio:tv' >/dev/null
expect "preferência salva em ~/.config/vitrola" "$(cat ~/.config/vitrola/preferencias.json)" "*\"size\": \"large\"*"
expect "autostart criado em segundo plano" "$(cat ~/.config/autostart/io.github.vitrola.Vitrola.desktop 2>/dev/null)" "*--em-segundo-plano*"
sleep 1
expect "saída de áudio trocada para a TV" "$(pactl get-default-sink)" "tv"

$V.Command '{"name":"playSearchResult","index":0,"videoID":"dQw4w9WgXcQ"}' >/dev/null
for _ in $(seq 40); do grep -q 'estado: ok' "$LOG" && break; sleep 1; done
sleep 3
$P play 2>/dev/null
sleep 4
expect "MPRIS mostra a faixa" "$($P metadata title 2>&1)" "*Never Gonna Give You Up*"
expect "MPRIS informa a capa como arquivo local" "$($P metadata mpris:artUrl 2>&1)" "file:///*/vitrola/capas/*.jpg"
expect "MPRIS: tocando depois do play" "$($P status 2>&1)" "Playing"
pos1="$($P position 2>/dev/null)"; sleep 3; pos2="$($P position 2>/dev/null)"
expect "a posição avança tocando ($pos1 → $pos2)" "$(awk -v a="$pos1" -v b="$pos2" 'BEGIN{print (b>a)?"sim":"não"}')" "sim"
$P volume 0.5; sleep 2
expect "volume pelo MPRIS chega ao YouTube Music" "$($V.GetState)" "*\"volume\":50*"
$P position 60; sleep 3
expect "ir para 60 s pelo MPRIS" "$($P position 2>&1)" "6[0-4].*"
$P pause; sleep 2
expect "pausar pelo MPRIS" "$($P status 2>&1)" "Paused"

$V.ActivateMenuItem 'quit' >/dev/null
sleep 3
expect "sair remove o player do MPRIS" "$(playerctl -l 2>&1)" "No players found"
kill "$APP" 2>/dev/null

if [[ $FAILED -ne 0 ]]; then
    echo "→ Log do app:"; grep -v "carregando (" "$LOG" | tail -40
    exit 1
fi
echo "  ✓ integração ok"
