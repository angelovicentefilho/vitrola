# Vitrola para Ubuntu (GNOME)

Versão da Vitrola para Ubuntu 24.04 ou mais novo, com GNOME em Wayland ou X11.
Em desenvolvimento: o plano completo está em
[`openspec/changes/linux-port/`](../openspec/changes/linux-port/) (proposta, specs, design e tarefas).

## Pastas

- `app/` — o app Vitrola (GTK4 + WebKitGTK, em JavaScript/GJS)
- `extension/` — a extensão do GNOME Shell (notch na barra superior)
- `test/` — testes unitários (`unit/`), ambiente Ubuntu em contêiner (`docker/`) e roteiros manuais
