# Spec Delta

## Purpose

Rodar o YouTube Music dentro da própria Vitrola no Ubuntu, sem navegador aberto, e expor o estado do player e os comandos de reprodução para o resto do app.

## ADDED Requirements

### Requirement: Player interno do YouTube Music
O sistema SHALL carregar `https://music.youtube.com` numa janela própria chamada "YouTube Music — Vitrola", sem depender de nenhum navegador instalado, e SHALL permitir tocar música nela.

#### Scenario: Primeira abertura
- **WHEN** o usuário abre a Vitrola pela primeira vez
- **THEN** a janela "YouTube Music — Vitrola" aparece com a página do YouTube Music carregada

#### Scenario: Tocar uma faixa
- **WHEN** o usuário clica numa música dentro da janela
- **THEN** o áudio toca pela saída de áudio padrão do sistema

### Requirement: Login persistente
O sistema SHALL guardar cookies e dados do site em armazenamento próprio do usuário, de modo que o login no Google continue válido depois de fechar e reabrir a Vitrola ou reiniciar a sessão.

#### Scenario: Reabrir depois de logar
- **WHEN** o usuário faz login, sai da Vitrola e a abre de novo
- **THEN** o YouTube Music abre já logado na mesma conta

#### Scenario: Login do Google não é bloqueado
- **WHEN** o usuário inicia o login do Google dentro da janela
- **THEN** a página de login aceita e-mail e senha, sem a mensagem de navegador não seguro

### Requirement: Janela do YouTube Music escondida ao abrir
Ao iniciar, a Vitrola SHALL manter a janela do YouTube Music escondida e mostrar só a vitrola flutuante, exceto na primeira abertura, quando a janela SHALL aparecer para o login.

#### Scenario: Abrir depois da primeira vez
- **WHEN** o usuário já usou a Vitrola antes e a abre de novo
- **THEN** a música pode ser controlada pela vitrola flutuante e a janela do YouTube Music não aparece

#### Scenario: Abrir com a Vitrola já rodando
- **WHEN** a Vitrola já está aberta e o usuário a abre de novo (atalho do menu de apps ou `vitrola`)
- **THEN** a janela do YouTube Music aparece

### Requirement: Fechar a janela não para a música
Fechar a janela do YouTube Music SHALL apenas escondê-la; a reprodução e a Vitrola SHALL continuar rodando até o usuário mandar sair.

#### Scenario: Fechar durante a reprodução
- **WHEN** uma música está tocando e o usuário fecha a janela do YouTube Music
- **THEN** a janela some e a música continua tocando

#### Scenario: Reabrir a janela
- **WHEN** a janela está escondida e o usuário escolhe "Abrir janela do YouTube Music" ou executa `vitrola` de novo
- **THEN** a mesma janela reaparece, sem recarregar a página nem interromper a música

### Requirement: Instância única
O sistema SHALL manter no máximo uma Vitrola rodando por usuário; executar `vitrola` com outra já ativa SHALL repassar o pedido para a instância existente.

#### Scenario: Abrir duas vezes
- **WHEN** a Vitrola já está rodando e o usuário executa `vitrola`
- **THEN** nenhum segundo player é criado e a janela do YouTube Music da instância existente é mostrada

### Requirement: Links externos vão para o navegador padrão
Páginas do YouTube e do Google (incluindo login) SHALL abrir dentro da janela da Vitrola; links para outros sites SHALL abrir no navegador padrão do sistema.

#### Scenario: Link de outro site
- **WHEN** o usuário clica num link para um site fora de youtube.com e google.com
- **THEN** o link abre no navegador padrão e a janela da Vitrola continua no YouTube Music

### Requirement: Recuperação de falhas
O sistema SHALL tentar carregar de novo a cada 5 segundos enquanto o primeiro carregamento falhar (por exemplo, sem internet ao abrir), e SHALL recarregar a página se o processo dela cair.

#### Scenario: Abrir sem internet
- **WHEN** a Vitrola abre sem conexão e a conexão volta depois
- **THEN** o YouTube Music carrega sozinho em até 5 segundos após a volta da conexão

#### Scenario: Processo da página cai
- **WHEN** o processo de conteúdo da página termina inesperadamente
- **THEN** a página é recarregada automaticamente

### Requirement: Leitura do estado do player
Enquanto a página do YouTube Music estiver carregada, o sistema SHALL ler a cada segundo título, artista, álbum, capa, posição, duração, se está tocando, se a faixa está curtida e o volume (0–100).

#### Scenario: Faixa tocando
- **WHEN** uma faixa está tocando
- **THEN** o estado lido traz título, artista, capa e posição que avança a cada leitura

#### Scenario: Fora do YouTube Music
- **WHEN** a janela está na tela de login do Google
- **THEN** nenhuma leitura falha com erro; o estado fica "sem faixa"

### Requirement: Comandos de reprodução
O sistema SHALL aceitar os comandos tocar/pausar, próxima, anterior, ir para posição, curtir/descurtir, definir volume (0–100), tocar item da fila, buscar e tocar resultado da busca, aplicando-os ao player do YouTube Music.

#### Scenario: Pausar
- **WHEN** a música está tocando e o comando tocar/pausar é enviado
- **THEN** a música pausa e a próxima leitura de estado indica "não tocando"

#### Scenario: Ir para posição
- **WHEN** o comando ir para posição com 60 segundos é enviado
- **THEN** a próxima leitura de estado indica posição entre 60 e 62 segundos
