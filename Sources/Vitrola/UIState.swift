import Foundation

enum PlaylistTab: String, CaseIterable {
    case queue, search

    var title: String {
        switch self {
        case .queue: return "A seguir"
        case .search: return "Buscar"
        }
    }
}

/// Estado de interface compartilhado entre menu, notch e janelas.
@MainActor
final class UIState: ObservableObject {
    static let shared = UIState()
    @Published var playlistTab: PlaylistTab = .queue
    @Published var focusSearch = 0          // incrementa para pedir foco no campo de busca

    /// Abre a janela da playlist já na aba de busca.
    func openSearch() {
        playlistTab = .search
        focusSearch += 1
        Settings.shared.showPlaylist = true
    }
}
