# Spec Delta

## Purpose

Levar o "notch" da Vitrola para a barra superior do GNOME: um indicador compacto da música atual que se expande com o vinil e os controles, em sessões Wayland e X11.

## ADDED Requirements

### Requirement: Notch recolhido na barra superior
Com a extensão da Vitrola ativa e a opção "Mostrar no notch" ligada, a barra superior do GNOME SHALL mostrar, na área central, uma pílula escura com a capa da faixa atual e um equalizador animado enquanto toca.

#### Scenario: Música tocando
- **WHEN** uma faixa está tocando na Vitrola
- **THEN** a pílula mostra a capa da faixa e o equalizador em movimento

#### Scenario: Nada tocando
- **WHEN** a Vitrola está rodando sem faixa carregada
- **THEN** a pílula mostra um ícone de nota musical

#### Scenario: Vitrola fechada
- **WHEN** a extensão está ativa mas o app Vitrola não está rodando
- **THEN** a pílula mostra a nota musical e clicar nela abre a Vitrola

### Requirement: Notch expandido ao passar o mouse
Quando o ponteiro ficar sobre a pílula por cerca de meio segundo, o notch SHALL expandir para baixo mostrando o vinil girando com a capa, título, artista, barra de progresso, tempo, os botões anterior/tocar-pausar/próxima, curtir, buscar, playlist e menu; SHALL recolher quando o ponteiro sair.

#### Scenario: Expandir
- **WHEN** o ponteiro fica sobre a pílula por meio segundo
- **THEN** o notch expande com vinil, informações da faixa e controles

#### Scenario: Recolher
- **WHEN** o ponteiro sai da área do notch expandido
- **THEN** o notch volta à pílula em até 1 segundo

#### Scenario: Passagem rápida
- **WHEN** o ponteiro só atravessa a pílula sem parar
- **THEN** o notch não expande

### Requirement: Controles no notch
Os botões do notch expandido SHALL agir sobre a música da Vitrola, e clicar na barra de progresso SHALL levar a música para o ponto clicado.

#### Scenario: Clicar na barra de progresso
- **WHEN** o usuário clica a 75% da barra de progresso
- **THEN** a música vai para 75% da duração

#### Scenario: Curtir
- **WHEN** o usuário clica no coração
- **THEN** a faixa fica curtida no YouTube Music e o coração aparece preenchido

#### Scenario: Botões de busca, playlist e menu
- **WHEN** o usuário clica na lupa, na lista ou no botão de menu
- **THEN** abre, respectivamente, a busca, a playlist "A seguir" ou o menu da Vitrola

### Requirement: Volume pela rolagem no notch
Rolar o mouse ou o touchpad sobre o notch, recolhido ou expandido, SHALL subir ou descer o volume do YouTube Music e mostrar o nível atual enquanto rola.

#### Scenario: Rolar para cima
- **WHEN** o usuário rola para cima sobre o notch
- **THEN** o volume do YouTube Music aumenta e um indicador mostra o novo nível

### Requirement: Clique direito abre o menu
Clicar com o botão direito no notch SHALL abrir o menu da Vitrola.

#### Scenario: Clique direito
- **WHEN** o usuário clica com o botão direito na pílula
- **THEN** o menu da Vitrola aparece junto ao notch

### Requirement: Funciona em Wayland e X11
O notch SHALL ter o mesmo comportamento em sessões GNOME Wayland e GNOME X11, no GNOME Shell 46 ou mais novo.

#### Scenario: Sessão X11
- **WHEN** o usuário entra em "Ubuntu em Xorg" com a extensão ativa
- **THEN** o notch aparece e expande como na sessão Wayland

### Requirement: Desligar o notch
Desligar "Mostrar no notch" no menu SHALL remover a pílula da barra superior sem desativar a extensão nem o resto da Vitrola.

#### Scenario: Desligar
- **WHEN** o usuário desmarca "Mostrar no notch"
- **THEN** a pílula some e a música continua tocando
