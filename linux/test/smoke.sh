#!/usr/bin/env bash
# Teste de fumaça da Vitrola para Linux, num contêiner Ubuntu 24.04 sem tela.
#   linux/test/smoke.sh          → monta a imagem (se preciso) e roda as verificações
# Precisa de Docker e de internet (o app abre music.youtube.com de verdade).
set -euo pipefail
cd "$(dirname "$0")/../.."

IMAGE="vitrola-linux-test"

echo "→ Montando a imagem ${IMAGE}…"
docker build -q -t "$IMAGE" linux/test/docker >/dev/null

echo "→ Rodando as verificações no contêiner…"
docker run --rm -v "$PWD:/vitrola:ro" "$IMAGE" \
    dbus-run-session -- xvfb-run -a bash linux/test/docker/smoke-inside.sh
