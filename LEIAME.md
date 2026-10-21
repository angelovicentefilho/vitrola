# Vitrola

Player de vinil para o **YouTube Music** no Mac. Fica no notch, no topo da tela, e opcionalmente numa janela flutuante.

## Instalar

No Terminal, dentro desta pasta:

```bash
./build.sh --install
```

O script compila, monta o `Vitrola.app`, copia para `/Applications` e abre.
Se faltar o compilador, ele avisa para rodar `xcode-select --install`.

## Primeira vez (uma vez só)

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
- **Playlist (A seguir):** abra pelo botão de lista no notch ou no cartão, ou pelo menu. Mostra a fila do YouTube Music com capinhas e duração, destaca a faixa atual e toca qualquer faixa com um clique. Atualiza sozinha enquanto estiver aberta.

## Como funciona

A cada segundo, a Vitrola executa um pequeno JavaScript na aba `music.youtube.com`, via AppleScript, para ler o título, o artista, a capa, o tempo e o estado do player. Os botões clicam nos controles do próprio player do YouTube Music. Nada sai do seu Mac.

## Observações

- Depois de recompilar, o macOS pode pedir a permissão de Automação de novo, porque a assinatura local muda.
- Se o YouTube Music mudar o HTML da página, os seletores ficam em `Sources/Vitrola/YouTubeMusicBridge.swift` (enum `Scripts`).
