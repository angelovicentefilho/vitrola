# Spec Delta

## Purpose

Permitir buscar e escolher músicas do YouTube Music e ver ou pular a fila "A seguir" sem abrir a janela do YouTube Music e sem interromper o que está tocando.

## ADDED Requirements

### Requirement: Janela da playlist com abas
O sistema SHALL ter uma janela "Playlist" com as abas "A seguir" e "Buscar", aberta pelo menu, pelo botão de lista do notch ou da vitrola, ou pelo atalho de busca.

#### Scenario: Abrir pela lista
- **WHEN** o usuário clica no botão de lista do notch
- **THEN** a janela da playlist abre na aba "A seguir"

#### Scenario: Abrir pela lupa
- **WHEN** o usuário clica na lupa do notch
- **THEN** a janela da playlist abre na aba "Buscar" com o campo de busca focado

### Requirement: Fila "A seguir"
A aba "A seguir" SHALL listar a fila do YouTube Music com capinha, título, artista e duração, destacar a faixa atual e atualizar sozinha a cada 4 segundos enquanto estiver aberta.

#### Scenario: Ver a fila
- **WHEN** há uma fila no YouTube Music e o usuário abre "A seguir"
- **THEN** as faixas aparecem na mesma ordem do YouTube Music, com a atual destacada

#### Scenario: Fila muda
- **WHEN** o YouTube Music passa para a próxima faixa com a aba aberta
- **THEN** em até 4 segundos o destaque passa para a nova faixa atual

### Requirement: Tocar item da fila
Clicar numa faixa da fila SHALL tocar essa faixa no YouTube Music.

#### Scenario: Pular para uma faixa
- **WHEN** o usuário clica na quinta faixa da fila
- **THEN** essa faixa começa a tocar e passa a ser a destacada

### Requirement: Busca sem interromper a música
A aba "Buscar" SHALL buscar o texto digitado no YouTube Music ao apertar Enter e listar até 40 resultados tocáveis (músicas e vídeos) com capinha, título e subtítulo, sem pausar nem trocar a faixa que está tocando.

#### Scenario: Buscar
- **WHEN** uma música está tocando e o usuário busca "Djavan"
- **THEN** os resultados aparecem e a música atual continua tocando

#### Scenario: Sem resultados
- **WHEN** a busca não traz resultados em cerca de 8 segundos
- **THEN** a aba mostra "Nenhum resultado (ou o YouTube Music demorou a responder)."

### Requirement: Tocar resultado da busca
Clicar num resultado SHALL tocar essa música ou vídeo no YouTube Music.

#### Scenario: Tocar resultado
- **WHEN** o usuário clica no primeiro resultado
- **THEN** a faixa escolhida começa a tocar e o notch, a vitrola e o MPRIS mostram a nova faixa

### Requirement: Atalho global de busca
Com a extensão ativa, o atalho Ctrl+Super+M SHALL abrir a aba "Buscar" com o campo focado a partir de qualquer app, em Wayland e X11. Sem a extensão, o comando `vitrola --buscar` SHALL fazer o mesmo, para o usuário associar a um atalho personalizado do GNOME.

#### Scenario: Atalho com outro app em foco
- **WHEN** o usuário está em outro app e aperta Ctrl+Super+M
- **THEN** a janela da playlist aparece na frente, na aba "Buscar", pronta para digitar

#### Scenario: Comando de linha
- **WHEN** o usuário executa `vitrola --buscar`
- **THEN** a janela da playlist abre na aba "Buscar", iniciando a Vitrola se ela não estiver rodando
