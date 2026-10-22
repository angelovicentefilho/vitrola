# Tasks

## 1. Estrutura e ambiente de teste

- [x] 1.1 Criar `linux/` com `app/{bin,data,src}`, `extension/`, `test/{unit,docker}` e um `linux/LEIAME.md` curto apontando para o design; verificar com `find linux -maxdepth 2`
- [x] 1.2 Criar `linux/test/docker/Dockerfile` (Ubuntu 24.04 com `gjs`, `gir1.2-gtk-4.0`, `gir1.2-webkit-6.0`, GStreamer good/bad/libav, `pulseaudio-utils`, `xvfb`, `dbus-x11`) e `linux/test/smoke.sh`; verificar que `docker build` conclui e `gjs -c "imports.gi.versions.WebKit='6.0'; imports.gi.WebKit"` roda no contêiner sem erro
- [x] 1.3 Configurar `node --test 'linux/test/unit/*.test.js'` (ou `npm test` em `linux/`) (sem dependências npm) com um teste trivial; verificar que passa no Mac e com `gjs -m` no contêiner

## 2. Spike do player (seguir ou parar)

- [x] 2.1 Criar `linux/app/src/main.js` com `Gtk.Application` (`io.github.vitrola.Vitrola`, instância única) e a janela "YouTube Music — Vitrola" com WebKitGTK 6.0, `NetworkSession` própria em `~/.local/share/vitrola/webkit`, cookies SQLite, user-agent Safari e `VITROLA_USER_AGENT`; verificar no contêiner que `smoke.sh` vê a página carregar `music.youtube.com`
- [x] 2.2 Criar `linux/run.sh` que confere as dependências e roda o app do código; verificar que ele aponta o pacote que falta quando um não está instalado
- [ ] 2.3 Validar numa VM/máquina Ubuntu 24.04 (Wayland): login do Google, reabrir já logado, 20 faixas variadas tocando (lançamentos, clipes, faixas antigas); registrar o resultado em `linux/test/spike.md`
- [ ] 2.4 Decisão de seguir ou parar: se o login ou mais de 1 em 20 faixas falharem, parar e reabrir o design para o plano B (Electron) antes das próximas fases; registrar a decisão em `linux/test/spike.md`

## 3. Player completo (`linux/web-player`)

- [ ] 3.1 Portar o enum `Scripts` e os parsers do Swift para `linux/app/src/youtube/scripts.js` (módulo puro, cabeçalho com origem e commit); verificar com testes unitários de `parse`, `parseQueue`, `parseSearch`, `largeArtwork` e `thumbnail` usando saídas de exemplo
- [ ] 3.2 Implementar o módulo do player atrás da interface `carregar`/`executarJS`/`mostrar`/`esconder`: só executa JS com a página carregada e em `music.youtube.com`, abre google/youtube na própria janela e o resto no navegador padrão, tenta de novo a cada 5 s no primeiro carregamento e recarrega se o processo cair; verificar com smoke no contêiner (iniciar sem rede, ligar a rede, página carrega)
- [ ] 3.3 Implementar o modelo de estado: leitura a cada 1 s, estado "sem faixa" fora do YouTube Music, comandos (tocar/pausar, próxima, anterior, ir para posição, curtir, volume, item da fila, busca, resultado); verificar com testes unitários do modelo (usando um player falso) e manualmente na VM pausando e indo para 60 s
- [ ] 3.4 Fechar a janela só esconde; `vitrola` de novo mostra a mesma janela sem recarregar; `--em-segundo-plano` inicia escondido; verificar manualmente na VM com música tocando
- [ ] 3.5 Documentar dependências, `run.sh` e o primeiro uso em `linux/LEIAME.md`; verificar seguindo o texto numa VM limpa

## 4. Controles de mídia (`linux/media-controls`)

- [ ] 4.1 Implementar o mapeamento estado → metadados/propriedades MPRIS (trackid, length em µs, artUrl, título, artista em lista, álbum, PlaybackStatus, Volume) e a detecção de saltos de posição como módulos puros; verificar com testes unitários
- [ ] 4.2 Implementar o download e cache das capas em `~/.cache/vitrola/capas/<sha1>.jpg`; verificar com teste do nome de arquivo e manualmente que o arquivo aparece
- [ ] 4.3 Publicar `org.mpris.MediaPlayer2.vitrola` (raiz + Player) com métodos, propriedades, `PropertiesChanged`, `Seeked`, `Raise` e `Quit`; verificar no contêiner com `gdbus introspect` e `gdbus call ... PlayPause`
- [ ] 4.4 Verificar na VM: o widget de mídia do GNOME mostra título, artista e capa, as teclas de mídia funcionam, `playerctl volume 0.5` muda o volume do YouTube Music para 50 e o player some ao sair
- [ ] 4.5 Atualizar `linux/LEIAME.md` com a integração de mídia; verificar que o texto bate com o comportamento da VM

## 5. Preferências, menu e interface privada (`linux/vitrola-menu`, `linux/audio-output`)

- [ ] 5.1 Implementar as preferências em `~/.config/vitrola/preferencias.json` com os padrões do Mac; verificar com testes unitários (primeira abertura, arquivo corrompido volta ao padrão)
- [ ] 5.2 Implementar o modelo puro do menu (ordem, rótulos, marcados, desabilitados sem faixa ou sem extensão); verificar com testes unitários dos cenários da spec `vitrola-menu`
- [ ] 5.3 Implementar a saída de áudio via `pactl --format=json` (listar, atual, trocar, erro com aviso); verificar com testes unitários do parser de JSON e manualmente na VM trocando para um segundo dispositivo
- [ ] 5.4 Publicar `io.github.vitrola.Vitrola` (estado JSON, preferências, `GetMenu`, `ActivateMenuItem`, `Command`, `ShowSearch`, `ShowPlaylist`, sinal `Changed`); verificar no contêiner com `gdbus call`
- [ ] 5.5 Mostrar o menu com `Gtk.PopoverMenu` num botão da barra de título da janela do YouTube Music; verificar na VM com a extensão desativada
- [ ] 5.6 Implementar "Abrir ao iniciar sessão" (`~/.config/autostart/io.github.vitrola.Vitrola.desktop`) e "Sair da Vitrola"; verificar na VM com logout/login
- [ ] 5.7 Documentar menu, saída de áudio e autostart em `linux/LEIAME.md`; verificar que o texto bate com o comportamento da VM

## 6. Vitrola flutuante (`linux/floating-vinyl`)

- [ ] 6.1 Criar a janela sem bordas e transparente com o disco (capa no centro, giro de 33⅓ rpm que retoma do mesmo ângulo, braço da agulha, cor da capa no fundo); verificar com teste unitário do relógio de giro e visualmente na VM
- [ ] 6.2 Implementar os visuais "Só o disco"/"Cartão com informações", os três tamanhos e a barra de progresso clicável; verificar na VM trocando cada opção pelo menu
- [ ] 6.3 Implementar arrastar (`begin_move`), volume pela rolagem, a barrinha de volume que só aparece com o ponteiro ou durante a rolagem, silenciar e voltar, e o clique direito abrindo o menu; verificar na VM em Wayland e Xorg
- [ ] 6.4 Documentar a vitrola flutuante em `linux/LEIAME.md`; verificar que o texto bate com a VM

## 7. Busca e playlist (`linux/search-and-queue`)

- [ ] 7.1 Implementar a janela "Playlist" com as abas "A seguir" (atualiza a cada 4 s, destaca a atual, clique toca) e "Buscar" (Enter busca, até 40 resultados, tenta ler a cada 0,5 s por até 8 s, mensagem sem resultados, clique toca); verificar com testes unitários da lógica de tentativas e manualmente na VM sem a música parar durante a busca
- [ ] 7.2 Implementar `vitrola --buscar` e `--playlist` via a instância única; verificar na VM com o app fechado e aberto
- [ ] 7.3 Documentar busca, playlist e o atalho personalizado sem extensão em `linux/LEIAME.md`; verificar seguindo o passo a passo na VM

## 8. Extensão do GNOME Shell (`linux/top-bar-notch` e partes de `floating-vinyl`, `vitrola-menu`, `search-and-queue`)

- [ ] 8.1 Criar o esqueleto (`metadata.json` para Shell 46+, `extension.js` ESM, esquema GSettings com atalho e posição); verificar na VM com `gnome-extensions enable` sem erros no `journalctl -f /usr/bin/gnome-shell`
- [ ] 8.2 Acompanhar o app pelo barramento (MPRIS + interface privada, `bus_watch_name`) e o estado "Vitrola fechada" com clique que inicia o app; verificar na VM abrindo e fechando o app
- [ ] 8.3 Desenhar a pílula recolhida (capa, equalizador, nota musical) ao lado do relógio e respeitar "Mostrar no notch"; verificar na VM tocando, pausando e desligando a opção
- [ ] 8.4 Implementar a expansão depois de ~0,5 s com o ponteiro parado e o recolhimento em até 1 s ao sair (vinil, título, artista, progresso clicável, tempo, controles, curtir, lupa, lista, menu); verificar na VM, incluindo a passagem rápida que não expande
- [ ] 8.5 Implementar o volume pela rolagem com indicador e o clique direito abrindo o menu; verificar na VM
- [ ] 8.6 Criar o ícone de disco na barra superior com o menu desenhado a partir do `GetMenu`; verificar na VM que os itens e marcados batem com o menu da janela
- [ ] 8.7 Gerenciar a janela da vitrola flutuante (encontrar pelo id do app + título, `make_above` conforme "Janela", salvar a posição ao fim do arrasto e restaurar ao abrir); verificar na VM em Wayland e Xorg
- [ ] 8.8 Registrar o atalho Ctrl+Super+M chamando `ShowSearch` (iniciando o app se preciso); verificar na VM com outro app em foco, em Wayland e Xorg
- [ ] 8.9 Documentar a instalação e ativação da extensão em `linux/LEIAME.md`; verificar seguindo o texto numa VM limpa

## 9. Instalação e integração final

- [ ] 9.1 Criar `linux/install.sh` (checa e instala pacotes, copia o app e a extensão, compila esquemas, cria `.desktop` e ícone) e `linux/uninstall.sh` (remove tudo, oferece apagar o login); verificar instalando e desinstalando numa VM limpa
- [ ] 9.2 Adicionar a seção "Ubuntu" ao `LEIAME.md` da raiz, apontando para `linux/LEIAME.md`; verificar que os links abrem
- [ ] 9.3 Rodar o roteiro manual completo das specs (todas as cenas) numa VM Ubuntu 24.04 em Wayland e em Xorg; registrar o resultado em `linux/test/roteiro-manual.md` com o que passou e o que falhou
- [ ] 9.4 Rodar `node --test 'linux/test/unit/*.test.js'` (ou `npm test` em `linux/`) e `linux/test/smoke.sh` e confirmar que tudo passa

## Workflow follow-up

- Revisar o código (`/code-review`) antes de abrir o PR da branch `linux-port`.
- Arquivar a mudança com `openspec archive linux-port` depois do merge, gerando as specs principais em `openspec/specs/linux/`.
- Abrir uma mudança separada para extrair os scripts do YouTube Music para `shared/`.
