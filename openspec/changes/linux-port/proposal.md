# Proposal

## Why

Hoje a Vitrola só existe para macOS (Swift + AppKit/SwiftUI) e o usuário quer a mesma experiência no Ubuntu com GNOME, tanto em Wayland quanto em X11. Nada do código de interface do Mac roda no Linux, e o Wayland impede que um app comum se desenhe na barra superior ou se mantenha sempre por cima, então é preciso uma versão própria, pensada para o GNOME.

## What Changes

- Nova pasta `linux/` neste repositório, com duas partes que se comunicam por D-Bus:
  - **App Vitrola** (GTK4 + WebKitGTK, em JavaScript/GJS): roda o YouTube Music internamente com login salvo, lê o estado do player, publica os controles no padrão MPRIS, define o menu da Vitrola, troca a saída de áudio e mostra a vitrola flutuante, a busca e a playlist.
  - **Extensão do GNOME Shell**: desenha o "notch" na barra superior (capa + equalizador, expandindo com vinil, progresso e controles), o ícone de disco com o menu da Vitrola, mantém a vitrola flutuante por cima das janelas e na posição salva, e registra o atalho global de busca.
  - Sem a extensão, o app continua funcionando (player, MPRIS, vitrola flutuante como janela normal, menu pela janela do YouTube Music).
- Os scripts que leem e controlam a página do YouTube Music são os mesmos do Mac (copiados para `linux/` nesta mudança).
- Script de instalação para o usuário (`linux/install.sh`) e seção "Ubuntu" no `LEIAME.md`.
- Ambiente de teste em contêiner Ubuntu para validar o app sem sair do Mac, mais validação manual numa máquina/VM Ubuntu.
- O app do Mac não muda.

Fora do escopo: o modo "aba do navegador" (AppleScript não existe no Linux), a opção de janela "Na mesa (atrás das janelas)", empacotamento Flatpak/Snap, publicação no extensions.gnome.org e extração dos scripts para uma pasta `shared/` comum aos dois apps.

## Capabilities

### New Capabilities

- `linux/web-player`: YouTube Music rodando dentro da Vitrola no Linux — login persistente, janela que esconde sem parar a música, instância única, recuperação de falhas, leitura de estado e envio de comandos ao player.
- `linux/media-controls`: integração com os controles de mídia do sistema (MPRIS): widget de mídia do GNOME, teclas de mídia, metadados, posição e volume.
- `linux/top-bar-notch`: o "notch" da Vitrola na barra superior do GNOME, recolhido e expandido, com controles, progresso clicável e volume pela rolagem.
- `linux/floating-vinyl`: a vitrola flutuante na tela — visual, tamanho, sempre na frente ou janela normal, posição lembrada.
- `linux/vitrola-menu`: o menu da Vitrola (controles, liga/desliga de notch/flutuante/playlist, visual, abrir o YouTube Music, abrir ao iniciar sessão, sair).
- `linux/search-and-queue`: busca no YouTube Music sem interromper a música, atalho global de busca e a playlist "A seguir".
- `linux/audio-output`: escolha do dispositivo de saída de áudio pelo menu da Vitrola.

### Modified Capabilities

(nenhuma — ainda não há specs no projeto e o app do Mac não muda)

## Impact

- **Código novo:** `linux/app/` (GJS), `linux/extension/` (GNOME Shell), `linux/install.sh`, `linux/run.sh`, `linux/test/`.
- **Código existente:** nenhum arquivo Swift alterado. `LEIAME.md` ganha uma seção.
- **Dependências no Ubuntu:** `gjs`, GTK 4, WebKitGTK 6.0 (`gir1.2-webkit-6.0`), plugins do GStreamer para áudio/vídeo (`gstreamer1.0-plugins-good`, `-bad`, `gstreamer1.0-libav`), GNOME Shell 46 ou mais novo (Ubuntu 24.04 LTS em diante).
- **Ferramentas de desenvolvimento:** Docker (contêiner Ubuntu 24.04) para testes de fumaça; Node só para testes unitários dos módulos puros (sem GTK).
- **Duplicação temporária:** os scripts do YouTube Music passam a existir em Swift (Mac) e em JS (Linux) até uma mudança futura criar a pasta `shared/`.
