import AppKit

/// Ponto único para abrir o menu da Vitrola fora da barra de menus
/// (botão ⋯ do notch e clique direito) — útil quando o ícone some atrás do notch.
@MainActor
enum AppMenu {
    static var show: @MainActor () -> Void = {}
}
