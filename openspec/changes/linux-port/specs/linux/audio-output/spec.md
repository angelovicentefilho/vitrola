# Spec Delta

## Purpose

Deixar o usuário escolher pelo menu da Vitrola em qual dispositivo o som sai (alto-falantes, fones, Bluetooth, HDMI), como faz no Mac.

## ADDED Requirements

### Requirement: Listar saídas de áudio
O submenu "Saída de áudio" SHALL listar pelo nome os dispositivos de saída disponíveis no sistema, marcar o atual, e o título do item SHALL ser "Saída de áudio: <nome do atual>".

#### Scenario: Com fone Bluetooth conectado
- **WHEN** há alto-falantes internos e um fone Bluetooth conectados
- **THEN** o submenu lista os dois e marca o que está em uso

#### Scenario: Nenhum dispositivo
- **WHEN** o sistema não informa nenhuma saída
- **THEN** o submenu mostra "Nenhum dispositivo encontrado" desabilitado

### Requirement: Trocar a saída padrão
Escolher um dispositivo SHALL torná-lo a saída padrão do sistema (igual às Configurações Rápidas do GNOME), e a música da Vitrola SHALL passar a sair por ele sem parar.

#### Scenario: Trocar para o fone
- **WHEN** a música está tocando e o usuário escolhe o fone Bluetooth
- **THEN** o som passa a sair pelo fone em até 2 segundos, sem pausar a música

#### Scenario: Falha ao trocar
- **WHEN** o sistema recusa a troca
- **THEN** a Vitrola avisa "Não foi possível trocar a saída de áudio" e sugere usar as Configurações Rápidas do GNOME

### Requirement: Funciona sem a extensão
A troca de saída de áudio SHALL funcionar com ou sem a extensão do GNOME Shell ativa.

#### Scenario: Pelo menu da janela
- **WHEN** a extensão está desativada e o usuário troca a saída pelo menu da janela do YouTube Music
- **THEN** a saída padrão muda
