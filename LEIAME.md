# Vitrola

Player de vinil para o **YouTube Music** no Mac. Fica no notch, no topo da tela, e opcionalmente numa janela flutuante.

## Instalar

No Terminal, dentro desta pasta:

```bash
./build.sh --install
```

O script compila, monta o `Vitrola.app`, copia para `/Applications` e abre.
Se faltar o compilador, ele avisa para rodar `xcode-select --install`.

## Player interno (padrão nesta branch)

O YouTube Music roda **dentro da Vitrola**, sem Chrome nem Safari abertos.
Na primeira vez abre a janela "YouTube Music — Vitrola": faça login na sua conta e toque algo.
Pode fechar a janela, que a música continua. Para reabri-la: notch › "Abrir YouTube Music", menu › "Abrir janela do YouTube Music", ou abra a Vitrola de novo pelo Finder/Launchpad.
As teclas de mídia do teclado também controlam o player interno.

## Usando uma aba do navegador (opcional)

Menu › Fonte da música › escolha o navegador. Aí é preciso, uma vez só:

1. **Liberar JavaScript por Apple Events no navegador**
   - Chrome / Brave / Edge: *Visualizar › Desenvolvedor › Permitir JavaScript de Apple Events*
   - Safari: *Ajustes › Avançado › Mostrar recursos para desenvolvedores web*, depois *Desenvolver › Permitir JavaScript de Apple Events*
2. Abra `music.youtube.com` e toque algo.
3. Quando o macOS perguntar se a Vitrola pode controlar o navegador, clique em **OK**.

Se recusou sem querer: *Ajustes do Sistema › Privacidade e Segurança › Automação › Vitrola*.

## Uso

- **Notch:** recolhido, mostra a capa e o equalizador. Com o mouse em cima, ele expande com o vinil, a barra de progresso (dá para clicar para avançar), os controles e o botão de curtir.
- **Ícone na barra de menus (disquinho):** controles, tamanho, visual (só o disco ou cartão), posição da janela, navegador, abrir ao iniciar sessão.
- **Vitrola flutuante:** ligue no menu. Arraste para mover; ela lembra a posição.
- **Volume:** role o mouse ou o trackpad sobre o notch ou a vitrola; ou arraste a barrinha vertical ao lado do disco (clique no alto-falante para silenciar).
- **Buscar:** aba "Buscar" na janela da playlist (ou a lupa no notch, ou o menu). Digite, Enter, clique no resultado para tocar — a música atual não é interrompida pela busca.
- **Playlist (A seguir):** abra pelo botão de lista no notch ou no cartão, ou pelo menu. Mostra a fila do YouTube Music com capinhas e duração, destaca a faixa atual e toca qualquer faixa com um clique. Atualiza sozinha enquanto estiver aberta.

## Como funciona

A cada segundo, a Vitrola executa um pequeno JavaScript na aba `music.youtube.com`, via AppleScript, para ler o título, o artista, a capa, o tempo e o estado do player. Os botões clicam nos controles do próprio player do YouTube Music. Nada sai do seu Mac.

## Observações

- Depois de recompilar, o macOS pode pedir a permissão de Automação de novo, porque a assinatura local muda.
- Se o YouTube Music mudar o HTML da página, os seletores ficam em `Sources/Vitrola/YouTubeMusicBridge.swift` (enum `Scripts`).
