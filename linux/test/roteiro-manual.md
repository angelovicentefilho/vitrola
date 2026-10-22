# Roteiro manual — Vitrola para Ubuntu

O que só dá para conferir num GNOME de verdade (VM ou máquina com Ubuntu 24.04+). Os testes automáticos
(`npm test` em `linux/` e `linux/test/smoke.sh`) cobrem o resto. Rode cada item em **Wayland** (padrão) e,
onde indicado, também em **"Ubuntu em Xorg"** (tela de login › engrenagem).

Marque `[x]` no que passou e anote o que falhou. Este arquivo é o registro da tarefa 9.3.

- Data / quem testou: _a preencher_
- Ubuntu e GNOME (Configurações › Sobre): _a preencher_

## Player (`linux/web-player`)

- [ ] Primeira abertura mostra "YouTube Music — Vitrola" com a página carregada
- [ ] Login do Google funciona; ao reabrir, já está logado (ver também `spike.md`)
- [ ] Uma música toca e o som sai pela saída padrão
- [ ] Pausar pela própria página e ir para 1:00 na barra do YouTube Music funcionam
- [ ] Fechar a janela com música tocando: a janela some e a música continua
- [ ] Rodar `vitrola` de novo: a mesma janela volta, sem recarregar e sem parar a música
- [ ] Ctrl+Q encerra a Vitrola e a música para
- [ ] Clicar num link para outro site (ex.: rodapé "Privacidade") abre no navegador padrão
- [ ] Abrir sem internet e ligar a rede depois: carrega sozinho em até 5 s

## Controles de mídia (`linux/media-controls`)

- [ ] O controle de mídia do GNOME (clique no relógio) mostra "Vitrola" com título, artista e **capa**
- [ ] Tecla de tocar/pausar do teclado pausa e volta a música
- [ ] "Próxima" no controle de mídia do GNOME passa de faixa; o título atualiza em até 2 s
- [ ] Clicar no nome "Vitrola" no controle de mídia traz a janela do YouTube Music
- [ ] Depois de "Sair da Vitrola", o player some do controle de mídia

## Menu, preferências e saída de áudio (`linux/vitrola-menu`, `linux/audio-output`)

- [ ] Com a extensão **desativada**: o botão ☰ da janela do YouTube Music abre o menu completo, e "Mostrar no notch"
      e "Sempre na frente" aparecem desabilitados com "(requer a extensão)"
- [ ] Sem faixa: o cabeçalho mostra a mensagem e Tocar/Próxima/Anterior/Curtir ficam desabilitados
- [ ] Saída de áudio: com um fone Bluetooth conectado, aparecem os dois; trocar para o fone leva o som para ele
      sem pausar
- [ ] "Abrir ao iniciar sessão": marcar, sair da sessão e entrar de novo → a Vitrola abre sozinha, sem mostrar a janela
- [ ] Desmarcar "Abrir ao iniciar sessão" e entrar de novo → não abre
- [ ] Ajuda e "Sobre a Vitrola" abrem
