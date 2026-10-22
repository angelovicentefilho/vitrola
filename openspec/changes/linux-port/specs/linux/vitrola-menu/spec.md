# Spec Delta

## Purpose

Dar ao usuário do Ubuntu o menu da Vitrola, com controles e preferências, acessível pela barra superior, pelo notch, pela vitrola flutuante e pela janela do YouTube Music.

## ADDED Requirements

### Requirement: Ícone da Vitrola na barra superior
Com a extensão ativa, a barra superior do GNOME SHALL mostrar um ícone de disco da Vitrola na área de indicadores; clicar nele SHALL abrir o menu da Vitrola.

#### Scenario: Abrir pelo ícone
- **WHEN** o usuário clica no ícone de disco na barra superior
- **THEN** o menu da Vitrola abre

### Requirement: Menu sem a extensão
Sem a extensão ativa, o menu da Vitrola SHALL continuar acessível por um botão de menu na barra de título da janela do YouTube Music e pelo clique direito na vitrola flutuante.

#### Scenario: Extensão desativada
- **WHEN** a extensão está desativada e o usuário abre o menu pela janela do YouTube Music
- **THEN** o menu mostra os controles e preferências, e os itens que dependem da extensão aparecem desabilitados com a indicação "requer a extensão"

### Requirement: Conteúdo do menu
O menu SHALL ter, nesta ordem: a faixa atual ("♪ título — artista") ou a mensagem de estado; Tocar/Pausar, Próxima faixa, Faixa anterior, Curtir/Descurtir, Saída de áudio, o volume atual; Mostrar no notch, Vitrola flutuante na tela, Playlist (A seguir), Buscar no YouTube Music…, Visual, Tamanho, Janela, Braço da agulha, Cor da capa no fundo, Barra de progresso; Abrir janela do YouTube Music, Ajuda, Abrir ao iniciar sessão; Sobre a Vitrola e Sair da Vitrola.

#### Scenario: Sem faixa
- **WHEN** nada está tocando
- **THEN** o cabeçalho mostra a mensagem de estado e Tocar/Pausar, Próxima, Anterior e Curtir aparecem desabilitados

#### Scenario: Opções marcadas
- **WHEN** a vitrola flutuante está ligada e o visual é "Só o disco"
- **THEN** "Vitrola flutuante na tela" aparece marcado e, em Visual, "Só o disco" aparece marcado

### Requirement: Mesmo menu em todos os pontos de acesso
O menu SHALL ter os mesmos itens e estados no ícone da barra superior, no notch, na vitrola flutuante e na janela do YouTube Music.

#### Scenario: Mudança refletida
- **WHEN** o usuário liga a playlist pelo menu do notch e depois abre o menu pela vitrola flutuante
- **THEN** "Playlist (A seguir)" aparece marcado nos dois

### Requirement: Preferências persistentes
Todas as opções marcáveis do menu SHALL ser salvas e restauradas ao reabrir a Vitrola, com os padrões do Mac: notch ligado, vitrola flutuante desligada, playlist desligada, visual "Cartão com informações", tamanho Médio, "Sempre na frente", braço da agulha, cor da capa e barra de progresso ligados.

#### Scenario: Primeira abertura
- **WHEN** a Vitrola abre pela primeira vez
- **THEN** as opções estão nos valores padrão

### Requirement: Abrir ao iniciar sessão
Marcar "Abrir ao iniciar sessão" SHALL fazer a Vitrola abrir automaticamente no próximo login, já com o player carregado e a janela do YouTube Music escondida; desmarcar SHALL desfazer isso.

#### Scenario: Login com a opção marcada
- **WHEN** a opção está marcada e o usuário entra na sessão
- **THEN** a Vitrola inicia sozinha, sem mostrar a janela do YouTube Music

### Requirement: Sair da Vitrola
"Sair da Vitrola" SHALL parar a música e encerrar o app; o notch, se a extensão continuar ativa, SHALL voltar ao estado "Vitrola fechada".

#### Scenario: Sair
- **WHEN** o usuário escolhe "Sair da Vitrola"
- **THEN** a música para, as janelas da Vitrola fecham e o notch mostra a nota musical
