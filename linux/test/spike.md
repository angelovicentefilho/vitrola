# Spike do player: WebKitGTK serve para a Vitrola?

Tarefas 2.3 e 2.4 de `openspec/changes/linux-port/tasks.md`. Decide se seguimos com o
WebKitGTK ou se trocamos o módulo do player por Electron (plano B, `design.md` D3).

## Já verificado no contêiner (Ubuntu 24.04, arm64, sem login) — 22/10/2026

| Verificação | Resultado |
|---|---|
| WebKitGTK disponível | 2.52.6 (API 6.0), GTK 4.14, GJS 1.80.2 |
| `music.youtube.com` carrega com o user-agent Safari | ✓ em ~3 s |
| JS da Vitrola roda na página (`document.title`) | ✓ "YouTube Music" |
| Cookies salvos em `~/.local/share/vitrola/webkit/cookies.sqlite` | ✓ |
| Reprodução anônima (`watch?v=dQw4w9WgXcQ`, saída de áudio virtual) | ✓ anúncio tocou, depois a faixa; posição avançando 5 s a cada 5 s, sem erro de mídia |

Conclusão parcial: codecs (GStreamer) e o streaming do YouTube (MSE) funcionam. **Falta o que só dá para testar com
a sua conta e com som de verdade**: o login do Google e as faixas variadas.

## Roteiro na VM ou máquina Ubuntu (você)

### Preparar

1. Ubuntu 24.04 Desktop com GNOME em Wayland (o padrão). Numa VM do UTM no Mac com chip Apple, use a imagem ARM64
   e ligue o dispositivo de som da VM.
2. Leve o código para lá (clone da branch `linux-port` ou pasta compartilhada do UTM).
3. Instale as dependências e rode:

   ```bash
   sudo apt install gjs gir1.2-gtk-4.0 gir1.2-webkit-6.0 \
       gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav
   linux/run.sh --debug
   ```

### Login (2.3)

- [ ] Clicar em "Fazer login" na janela da Vitrola e entrar com a conta Google (inclusive a verificação em duas etapas)
- [ ] A página aceitou o e-mail e a senha, sem "Este navegador ou app pode não ser seguro"
- [ ] Fechar a Vitrola (Ctrl+C no terminal), abrir de novo com `linux/run.sh`: já abre logado

Se o login for bloqueado, tente de novo com outro user-agent antes de dar como falha:

```bash
VITROLA_USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15" linux/run.sh
```

### 20 faixas (2.3)

Tocar cada uma pela própria janela e marcar se o som saiu e a música avançou por pelo menos 30 s.

| # | Tipo | Faixa (anote qual) | Tocou? |
|---|---|---|---|
| 1–5 | Lançamentos deste ano | | |
| 6–10 | Clipes (vídeo, aba "Vídeo") | | |
| 11–15 | Faixas antigas / catálogo | | |
| 16–18 | Playlists ou rádio (deixe passar de faixa sozinho) | | |
| 19–20 | Algo que você ouve sempre | | |

Anote também: travou a interface? Uso de CPU alto (veja no Monitor do Sistema)? Alguma mensagem de erro no terminal?

## Decisão (2.4)

Regra: **parar** e reabrir o design para o plano B se o login falhar com os dois user-agents
ou se mais de 1 das 20 faixas não tocar.

- Resultado do login: _a preencher_
- Faixas que tocaram: _a preencher_ / 20
- Decisão: _seguir com WebKitGTK_ / _parar e ir para o plano B_
- Data e quem testou: _a preencher_
