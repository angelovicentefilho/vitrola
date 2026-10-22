# Spec Delta

## Purpose

Oferecer no Ubuntu a vitrola flutuante do Mac: uma janela sem bordas com o disco girando e os controles, que o usuário posiciona onde quiser na tela.

## ADDED Requirements

### Requirement: Vitrola flutuante liga e desliga
O sistema SHALL mostrar uma janela sem bordas e com fundo transparente contendo a vitrola quando "Vitrola flutuante na tela" estiver ligada, e SHALL escondê-la quando desligada; a escolha SHALL ser lembrada entre aberturas.

#### Scenario: Ligar
- **WHEN** o usuário marca "Vitrola flutuante na tela"
- **THEN** a vitrola aparece na tela

#### Scenario: Lembrar entre aberturas
- **WHEN** a vitrola flutuante estava ligada e o usuário reabre a Vitrola
- **THEN** a vitrola flutuante aparece de novo

### Requirement: Disco girando com a música
O disco SHALL mostrar a capa da faixa no centro e girar a 33⅓ rotações por minuto só enquanto a música toca, retomando do mesmo ângulo depois de uma pausa.

#### Scenario: Pausar e voltar
- **WHEN** a música pausa e depois volta a tocar
- **THEN** o disco para no ângulo em que estava e volta a girar a partir dele, sem salto

### Requirement: Visual e tamanho
O usuário SHALL poder escolher o visual "Só o disco" ou "Cartão com informações", o tamanho Pequeno, Médio ou Grande, e ligar ou desligar o braço da agulha, a cor da capa no fundo e a barra de progresso; cada escolha SHALL ser lembrada.

#### Scenario: Cartão com informações
- **WHEN** o visual é "Cartão com informações"
- **THEN** a vitrola mostra o disco com título, artista, progresso e os botões curtir, playlist e menu

#### Scenario: Mudar tamanho
- **WHEN** o usuário escolhe "Grande"
- **THEN** a vitrola passa a ter o disco no tamanho grande

### Requirement: Mover arrastando e lembrar a posição
O usuário SHALL poder mover a vitrola arrastando-a, e a posição SHALL ser restaurada ao reabrir quando a extensão da Vitrola estiver ativa.

#### Scenario: Restaurar a posição
- **WHEN** o usuário arrasta a vitrola para o canto inferior direito e reabre a Vitrola com a extensão ativa
- **THEN** a vitrola volta a aparecer no canto inferior direito

#### Scenario: Sem extensão
- **WHEN** a extensão da Vitrola não está ativa
- **THEN** a vitrola ainda pode ser arrastada, mas a posição inicial fica a cargo do GNOME

### Requirement: Sempre na frente ou janela normal
O usuário SHALL poder escolher "Sempre na frente" ou "Janela normal". Com a extensão ativa, "Sempre na frente" SHALL manter a vitrola acima das outras janelas em Wayland e X11.

#### Scenario: Sempre na frente
- **WHEN** a opção é "Sempre na frente" e o usuário clica em outra janela
- **THEN** a vitrola continua visível por cima dela

#### Scenario: Sempre na frente sem extensão
- **WHEN** a opção é "Sempre na frente" mas a extensão não está ativa
- **THEN** a vitrola se comporta como janela normal e o menu explica que a extensão é necessária para ficar por cima

### Requirement: Volume na vitrola flutuante
Rolar sobre a vitrola SHALL mudar o volume do YouTube Music; uma barrinha vertical de volume SHALL aparecer ao lado do disco só com o ponteiro sobre a vitrola ou durante a rolagem, permitindo arrastar o nível e silenciar pelo ícone do alto-falante.

#### Scenario: Silenciar
- **WHEN** o usuário clica no ícone do alto-falante da barrinha
- **THEN** o volume vai a 0, e um novo clique devolve o último volume audível

#### Scenario: Barrinha escondida
- **WHEN** o ponteiro não está sobre a vitrola e ninguém está rolando
- **THEN** a barrinha de volume não aparece

### Requirement: Clique direito abre o menu
Clicar com o botão direito na vitrola flutuante SHALL abrir o menu da Vitrola.

#### Scenario: Clique direito
- **WHEN** o usuário clica com o botão direito na vitrola
- **THEN** o menu da Vitrola aparece
