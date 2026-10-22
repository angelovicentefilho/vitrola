# Vitrola para Ubuntu (GNOME)

Player de vinil para o **YouTube Music** no Ubuntu 24.04 ou mais novo, com GNOME em Wayland ou X11.
O YouTube Music roda dentro da própria Vitrola, sem navegador aberto.

O plano completo (proposta, specs, design e tarefas) está em
[`openspec/changes/linux-port/`](../openspec/changes/linux-port/).

## Rodar direto do código

1. Instale as dependências:

   ```bash
   sudo apt install gjs gir1.2-gtk-4.0 gir1.2-webkit-6.0 \
       gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav
   ```

2. Abra a Vitrola:

   ```bash
   linux/run.sh            # ou linux/run.sh --debug para ver mensagens de diagnóstico
   ```

   Se faltar algum pacote, o `run.sh` diz qual e o comando para instalar.

## Primeiro uso

- Abre a janela **"YouTube Music — Vitrola"**: faça login na sua conta e toque algo.
- O login fica salvo só para a Vitrola, em `~/.local/share/vitrola/webkit`. Na próxima vez ela abre já logada.
- **Fechar a janela não para a música**: ela só se esconde. Para mostrá-la de novo, rode `vitrola`
  (ou `linux/run.sh`) outra vez — a Vitrola é de instância única, então isso só traz a janela de volta.
- Para sair de vez: **Ctrl+Q** com a janela em foco.
- `vitrola --em-segundo-plano` inicia com a janela escondida (é o que o "Abrir ao iniciar sessão" usa).

Se o login do Google recusar o navegador, dá para testar outro user-agent:

```bash
VITROLA_USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15" linux/run.sh
```

Sem internet ao abrir? A Vitrola tenta de novo a cada 5 segundos e carrega sozinha quando a conexão voltar.

## Controles de mídia

A Vitrola aparece no **controle de mídia do GNOME** (clique no relógio, na barra superior) com título, artista
e capa, e responde às **teclas de mídia** do teclado. Por baixo é o padrão MPRIS, então qualquer app que o
entenda funciona — por exemplo, no terminal:

```bash
playerctl -p vitrola play-pause     # tocar/pausar
playerctl -p vitrola next           # próxima
playerctl -p vitrola volume 0.5     # volume do YouTube Music em 50%
```

## Menu da Vitrola

- Com a extensão do GNOME Shell: pelo ícone de disco na barra superior, pelo notch ou com o botão direito na vitrola.
- Sem a extensão: pelo botão **☰** na barra de título da janela do YouTube Music, ou com o botão direito na vitrola
  flutuante. Os itens que precisam da extensão aparecem desabilitados com "(requer a extensão)".

No menu:

- **Saída de áudio** lista alto-falantes, fones, Bluetooth, HDMI… e troca a saída do sistema (igual às
  Configurações Rápidas do GNOME). Usa o `pactl`, que já vem no Ubuntu (pacote `pulseaudio-utils`).
- **Abrir ao iniciar sessão** cria `~/.config/autostart/io.github.vitrola.Vitrola.desktop`; a Vitrola passa a abrir
  sozinha no login, com a janela do YouTube Music escondida.
- **Sair da Vitrola** para a música e fecha tudo.
- As preferências ficam em `~/.config/vitrola/preferencias.json`.

## Pastas

- `app/` — o app Vitrola (GTK4 + WebKitGTK, em JavaScript/GJS)
- `extension/` — a extensão do GNOME Shell (notch na barra superior)
- `test/` — testes unitários (`unit/`), ambiente Ubuntu em contêiner (`docker/`) e roteiros manuais

## Testes (para quem desenvolve)

```bash
cd linux && npm test          # testes unitários no Node (também rodam no GJS: gjs -m test/unit/run-gjs.js)
linux/test/smoke.sh           # teste de fumaça num contêiner Ubuntu 24.04 (precisa de Docker e internet)
```

O roteiro do que só dá para conferir num GNOME de verdade está em [`test/roteiro-manual.md`](test/roteiro-manual.md).
