# Spec Delta

## Purpose

Integrar a Vitrola aos controles de mídia padrão do Linux (MPRIS), para que o GNOME, as teclas de mídia e outros apps vejam e controlem o que está tocando.

## ADDED Requirements

### Requirement: Player MPRIS publicado
Enquanto estiver rodando, a Vitrola SHALL se publicar no barramento de sessão como player MPRIS com o nome "Vitrola", e SHALL deixar de aparecer quando sair.

#### Scenario: Aparece no GNOME
- **WHEN** a Vitrola está rodando e uma faixa está tocando
- **THEN** o controle de mídia do GNOME (na área de notificações) mostra "Vitrola" com título, artista e capa da faixa

#### Scenario: Some ao sair
- **WHEN** o usuário sai da Vitrola
- **THEN** o player "Vitrola" desaparece do controle de mídia do GNOME

### Requirement: Metadados e estado
O sistema SHALL informar via MPRIS título, artista, álbum, capa, duração, estado (tocando/pausado/parado) e posição, atualizando em até 2 segundos após mudar no YouTube Music.

#### Scenario: Troca de faixa
- **WHEN** o YouTube Music passa para a próxima faixa
- **THEN** em até 2 segundos o MPRIS informa o título, artista e capa da nova faixa

#### Scenario: Capa disponível localmente
- **WHEN** a faixa tem capa
- **THEN** a capa informada pelo MPRIS é um arquivo local legível, para que o GNOME consiga exibi-la

### Requirement: Controle pelo sistema
Comandos MPRIS de tocar, pausar, tocar/pausar, próxima, anterior, parar, avançar/voltar e ir para posição SHALL ser aplicados ao player do YouTube Music.

#### Scenario: Tecla de mídia
- **WHEN** o usuário aperta a tecla de tocar/pausar do teclado
- **THEN** a música da Vitrola pausa ou volta a tocar

#### Scenario: Próxima pelo GNOME
- **WHEN** o usuário clica em "próxima" no controle de mídia do GNOME
- **THEN** o YouTube Music passa para a próxima faixa

### Requirement: Volume pelo MPRIS
O volume MPRIS SHALL refletir o volume do YouTube Music (0–100 mapeado para 0,0–1,0), e alterá-lo pelo MPRIS SHALL mudar o volume do YouTube Music.

#### Scenario: Ajustar volume por outro app
- **WHEN** um cliente MPRIS define o volume da Vitrola para 0,5
- **THEN** o volume do YouTube Music passa a 50

### Requirement: Saltos de posição avisados
Quando a posição mudar fora do ritmo normal (busca, nova faixa, arrasto), o sistema SHALL emitir o aviso de salto do MPRIS com a nova posição.

#### Scenario: Usuário avança a música
- **WHEN** o usuário clica no meio da barra de progresso
- **THEN** clientes MPRIS recebem o aviso de salto com a nova posição

### Requirement: Trazer para frente e sair pelo MPRIS
O pedido MPRIS de trazer para frente SHALL mostrar a janela do YouTube Music, e o pedido de sair SHALL encerrar a Vitrola.

#### Scenario: Clicar no player no GNOME
- **WHEN** o usuário clica no nome "Vitrola" no controle de mídia do GNOME
- **THEN** a janela do YouTube Music da Vitrola aparece
