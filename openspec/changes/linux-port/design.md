# Design

## Context

- O app do Mac (`Sources/Vitrola/`) é Swift + AppKit/SwiftUI. O que dá para levar ao Linux são o comportamento, o visual e os JavaScripts que conversam com a página do YouTube Music (enum `Scripts` em `YouTubeMusicBridge.swift`). Nenhuma interface Swift roda no Linux.
- Alvo: Ubuntu 24.04 LTS em diante (GNOME Shell 46+, GJS 1.80+, GTK 4.14+, WebKitGTK 2.44+ com a API 6.0). Sessão padrão Wayland; "Ubuntu em Xorg" onde ainda existir.
- Limites do Wayland/GTK4 que moldam o desenho: um app comum não desenha na barra superior, não escolhe a própria posição, não lê onde está na tela e não se mantém por cima. O GTK4 também removeu `move` e `keep_above`, então nem no X11 o app resolve isso sozinho. No GNOME, quem pode tudo isso é o próprio Shell (Mutter), ou seja, uma extensão.
- O desenvolvimento acontece num Mac: GJS, GTK e WebKitGTK não rodam aqui. Precisamos de um caminho de teste fora de uma máquina Ubuntu.

## Goals / Non-Goals

**Goals:**
- O app funciona sozinho (player, MPRIS, vitrola flutuante, busca, playlist, menu na janela). A extensão acrescenta o que só o Shell pode fazer.
- O comportamento é o mesmo em Wayland e X11, porque nos dois casos quem age é o Mutter via extensão.
- O máximo possível de lógica em módulos puros (sem GTK), testáveis com Node no Mac e com GJS no contêiner.
- Validar cedo os dois riscos que podem invalidar o plano: login do Google e reprodução no WebKitGTK.

**Non-Goals:**
- Paridade de código com o Mac ou compartilhamento de arquivos entre as duas versões nesta mudança.
- Ambientes que não sejam GNOME (KDE, XFCE etc.). O app até roda neles, mas sem notch e sem garantia.
- Flatpak, Snap e publicação na loja de extensões.

## Decisions

### D1. Duas peças: app GTK4 + extensão do GNOME Shell, ligadas por D-Bus
O app é dono do player e de todo o estado. A extensão é uma "tela" na barra superior e a mão que posiciona janelas.
- *Alternativa: só app nativo.* Sem notch e sem "sempre na frente" no Wayland. Descartado.
- *Alternativa: só extensão.* Rodar WebKit e áudio dentro do processo do Shell arrisca derrubar a sessão e não é aceito nas regras de extensões. Descartado.

### D2. JavaScript (GJS) nas duas peças
A extensão precisa ser GJS de qualquer forma. Com GJS no app, o projeto fica numa linguagem só, os scripts do YouTube Music entram como JS nativo e os módulos puros rodam também no Node.
- *Alternativas:* Python + PyGObject (outra linguagem a manter), Rust + gtk-rs ou Vala (compilação e curva maiores para um app pequeno), Electron (ver D3).

### D3. WebKitGTK 6.0 como player, com Electron como plano B
É o mesmo motor do WKWebView do Mac, já vem no Ubuntu e não exige empacotar um navegador.
- *Riscos:* o Google pode bloquear o login, e não há Widevine (DRM).
- *Mitigação:* a fase 1 (tarefas) é um spike com critério de seguir ou parar: login funcionando, e 20 faixas variadas tocando, incluindo lançamentos recentes e clipes.
- *Plano B:* trocar só o módulo do player por Electron (Chromium com Widevine via build castlabs), mantendo D-Bus, MPRIS e extensão iguais. Por isso o player fica atrás de uma interface pequena: `carregar`, `executarJS`, `mostrar`/`esconder` e eventos de estado.
- *User-agent:* o mesmo Safari/macOS do app do Mac, que já passa no login do Google. Pode ser trocado pela variável `VITROLA_USER_AGENT` para testes.

### D4. Dados do site em `~/.local/share/vitrola/webkit`
Usamos uma `NetworkSession` própria com diretórios de dados e cache do app e cookies persistentes em SQLite. Isso isola a Vitrola do Epiphany e de outros apps WebKit, e "Sair da conta" fica restrito à Vitrola.

### D5. Scripts do YouTube Music copiados para um módulo JS puro
`linux/app/src/youtube/scripts.js` reproduz o enum `Scripts` e os parsers (`parse`, `parseQueue`, `parseSearch`, `largeArtwork`, `thumbnail`) do Swift. O cabeçalho do arquivo aponta a origem e o commit de referência. Testes unitários cobrem os parsers com saídas de exemplo.
- *Alternativa: extrair já para `shared/`.* Exige mexer no `Package.swift` e no app do Mac que está funcionando. Fica para uma mudança própria.

### D6. MPRIS para controles do sistema + interface privada para o resto
- `org.mpris.MediaPlayer2.vitrola` cobre o que o padrão define: estado, metadados, comandos, volume, `Seeked`, `Raise` e `Quit`.
- `io.github.vitrola.Vitrola` em `/io/github/vitrola/Vitrola` cobre o que o MPRIS não tem: curtir, estado detalhado (mensagem de status, faixa curtida), preferências, menu, abrir busca e playlist, e o aviso de quais janelas a extensão deve gerenciar.
- Por simplicidade, os payloads ricos (estado, menu, preferências) trafegam como JSON em strings, com um sinal `Changed` quando algo muda.
- O notch consome MPRIS + interface privada. Ele não lê a página nem guarda estado próprio.

### D7. Menu definido uma vez, desenhado em dois lugares
O app monta a descrição do menu num módulo puro (itens, marcados, habilitados) e a expõe via `GetMenu()`/`ActivateMenuItem(id)`.
- A extensão desenha com `PopupMenu` do Shell (ícone de disco e notch). O app desenha com `Gtk.PopoverMenu` (janela do YouTube Music e vitrola flutuante).
- *Alternativa: StatusNotifierItem/AppIndicator.* Não há AppIndicator para GTK4 (a libayatana é GTK3), e implementar SNI + DBusMenu à mão daria mais trabalho que o caminho acima, que já temos com a extensão. Descartado.

### D8. A extensão posiciona e mantém a vitrola flutuante por cima
A extensão encontra a janela da vitrola pelo id do app (`io.github.vitrola.Vitrola`) + título fixo.
- Ela aplica `make_above()`/`unmake_above()` conforme a opção "Janela".
- Grava a posição (do retângulo do quadro, ao terminar um arrasto) nas próprias GSettings e a restaura quando a janela é criada.
- O arrasto em si é do app (`Gdk.Toplevel.begin_move`), que funciona em Wayland e X11.
- A opção "Na mesa (atrás das janelas)" do Mac fica fora: o Mutter não oferece "sempre atrás" para janelas comuns.

### D9. Atalho global registrado pela extensão
`Main.wm.addKeybinding` com uma chave GSettings da extensão (padrão `<Control><Super>m`), chamando `ShowSearch()` no app (e iniciando o app se preciso).
- Sem a extensão, o `vitrola --buscar` (via `Gtk.Application` de instância única) atende a um atalho personalizado do GNOME.
- *Alternativa: portal GlobalShortcuts.* Só existe no GNOME 48+, e o Ubuntu 24.04 tem o 46.

### D10. Saída de áudio pelo app via `pactl`
`pactl --format=json list sinks`, `get-default-sink` e `set-default-sink`, sobre o PipeWire (`pipewire-pulse`, padrão no Ubuntu). Funciona com ou sem a extensão.
- *Alternativa: Gvc dentro da extensão.* Deixaria o recurso preso à extensão. `wpctl` não tem saída em JSON.

### D11. Capa como arquivo local para o MPRIS
A capa é baixada (`=w800-h800`) para `~/.cache/vitrola/capas/<sha1>.jpg` e informada como `file://`. O widget de mídia do GNOME carrega arquivos locais de forma confiável, e o notch e a vitrola reaproveitam o mesmo arquivo.

### D12. Preferências em JSON do app; posição da janela e atalho nas GSettings da extensão
O app guarda `~/.config/vitrola/preferencias.json`, com os padrões do Mac, e não precisa instalar esquema GSettings. A extensão guarda o que só ela usa (posição, atalho) no esquema dela, compilado pelo `install.sh`.

### D13. "Abrir ao iniciar sessão" via `~/.config/autostart`
Um arquivo `.desktop` com `Exec=vitrola --em-segundo-plano`, que inicia o player com a janela escondida. Criado e removido pelo app.

### D14. Teste em três camadas
1. **Unitário:** módulos puros com `node --test` (no Mac) e `gjs -m` (no contêiner).
2. **Fumaça em contêiner:** imagem Ubuntu 24.04 (arm64 no Docker deste Mac) com Xvfb + `dbus-run-session`. Sobe o app, verifica o nome MPRIS e a interface privada no barramento, e confere que a página do YouTube Music carregou.
3. **Manual numa VM/máquina Ubuntu** (Wayland e Xorg): login, reprodução, notch, atalho, saída de áudio. A extensão só é testada aqui, porque precisa de um GNOME Shell de verdade.

### Organização de pastas

```
linux/
├── run.sh                 roda direto do código (desenvolvimento)
├── install.sh             instala para o usuário em ~/.local
├── uninstall.sh
├── app/
│   ├── bin/vitrola
│   ├── data/              .desktop, ícone
│   └── src/               main, player (WebKit), youtube/ (scripts puros), mpris, service, menu, prefs,
│                          floating, playlist, audio, capas
├── extension/             vitrola@vitrola.github.io (notch, ícone+menu, janelas, atalho, schemas/)
└── test/                  unit/, docker/Dockerfile, smoke.sh
```

## Risks / Trade-offs

- [Google bloqueia login no WebKitGTK] → Spike na fase 1 testando o user-agent Safari e variações; se falhar, plano B (D3).
- [Faixas que exigem DRM não tocam] → Medir na fase 1 com 20 faixas; se houver bloqueio relevante, plano B.
- [Codecs ausentes no GStreamer] → `install.sh` checa e instala `gstreamer1.0-plugins-good/-bad` e `gstreamer1.0-libav`, e a ajuda explica o sintoma.
- [Extensões quebram a cada versão do GNOME] → `metadata.json` declara as versões testadas (46+), e a extensão usa só APIs estáveis (`PanelMenu`, `PopupMenu`, `Main.wm`, `Meta.Window`).
- [Scripts duplicados entre Swift e JS divergem] → Cabeçalho com origem e commit de referência, e testes de parser com as mesmas amostras. A pasta `shared/` vem numa mudança futura.
- [Polling a cada 1 s gasta CPU] → Mesmo ritmo do Mac. A leitura só roda com a página no YouTube Music.
- [Sem extensão, a experiência fica menor] → O app avisa no menu e na ajuda como ativar a extensão.
- [Não dá para testar a extensão no Mac] → Testes manuais documentados numa VM Ubuntu (UTM) antes de dar a fase por concluída.

## Migration Plan

Não há migração: é um app novo, instalado ao lado de nada. `install.sh` copia para `~/.local/share/vitrola`, `~/.local/bin/vitrola`, `~/.local/share/applications` e `~/.local/share/gnome-shell/extensions/`. `uninstall.sh` remove tudo isso e o autostart, e oferece apagar os dados do site (login).

## Open Questions

- Identificadores finais para publicação (id do app `io.github.vitrola.Vitrola` e UUID da extensão `vitrola@vitrola.github.io`): servem para desenvolvimento e podem mudar antes de publicar, sem afetar o comportamento.
- Posição da pílula na barra superior (padrão: ao lado esquerdo do relógio, no centro). Pode virar preferência depois.
