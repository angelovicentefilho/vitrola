#!/usr/bin/env bash
# Compila a Vitrola e monta o Vitrola.app.
#   ./build.sh            → gera build/Vitrola.app
#   ./build.sh --install  → gera, copia para /Applications e abre
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="Vitrola"
APP="build/${APP_NAME}.app"

if ! xcode-select -p >/dev/null 2>&1; then
  echo "✗ Faltam as ferramentas de linha de comando da Apple."
  echo "  Rode: xcode-select --install   (e depois rode este script de novo)"
  exit 1
fi

echo "→ Compilando…"
swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"

echo "→ Montando ${APP}…"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/$APP_NAME" "$APP/Contents/MacOS/$APP_NAME"
cp Support/Info.plist "$APP/Contents/Info.plist"
iconutil -c icns Support/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"

# Assinatura local (ad-hoc): suficiente para uso pessoal.
codesign --force --sign - "$APP" >/dev/null
echo "✓ Pronto: $APP"

if [[ "${1:-}" == "--install" ]]; then
  pkill -x "$APP_NAME" 2>/dev/null || true
  rm -rf "/Applications/${APP_NAME}.app"
  cp -R "$APP" /Applications/
  open "/Applications/${APP_NAME}.app"
  echo "✓ Instalado em /Applications e aberto. Procure o disquinho na barra de menus."
fi
