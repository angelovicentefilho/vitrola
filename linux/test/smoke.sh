#!/usr/bin/env bash
# Teste de fumaça da Vitrola para Linux, num contêiner Ubuntu 24.04 sem tela.
#   linux/test/smoke.sh          → monta a imagem (se preciso) e roda todos os cenários
# Precisa de Docker e de internet (o app abre music.youtube.com de verdade).
set -euo pipefail
cd "$(dirname "$0")/../.."

IMAGE="vitrola-linux-test"
RUN=(docker run --rm -v "$PWD:/vitrola:ro" "$IMAGE" dbus-run-session -- xvfb-run -a bash linux/test/docker/smoke-inside.sh)

echo "→ Montando a imagem ${IMAGE}…"
docker build -q -t "$IMAGE" linux/test/docker >/dev/null

"${RUN[@]}" normal 2>&1 | grep -v 'unknown child process'

docker run --rm -v "$PWD:/vitrola:ro" "$IMAGE" dbus-run-session -- xvfb-run -a \
    bash linux/test/docker/integration-inside.sh 2>&1 | grep -vE 'unknown child process|^ALSA|^\[|pw\.conf'

# Sem rede ao abrir: desliga a rede do contêiner logo no início e religa depois de 15 s.
NAME="vitrola-smoke-offline-$$"
docker run -d --name "$NAME" -v "$PWD:/vitrola:ro" "$IMAGE" \
    dbus-run-session -- xvfb-run -a bash linux/test/docker/smoke-inside.sh offline >/dev/null
docker network disconnect bridge "$NAME"
sleep 15
docker network connect bridge "$NAME"
status="$(docker wait "$NAME")"
docker logs "$NAME" 2>&1 | grep -v 'unknown child process'
docker rm "$NAME" >/dev/null

[[ "$status" == "0" ]] && echo "✓ Tudo certo" || { echo "✗ Algum cenário falhou"; exit 1; }
