import Foundation

/// Busca no YouTube Music usando a própria página (sem recarregar: a música não para).
@MainActor
final class SearchModel: ObservableObject {
    enum Phase: Equatable { case idle, searching, done, failed(String) }

    @Published var query = ""
    @Published private(set) var results: [SearchResult] = []
    @Published private(set) var phase: Phase = .idle

    private let player: PlayerModel
    private var token = 0
    private var attempts = 0
    private static let maxAttempts = 16      // 16 × 0,5 s ≈ 8 s

    init(player: PlayerModel) {
        self.player = player
    }

    func search() {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        token += 1
        attempts = 0
        phase = .searching
        results = []
        player.source.send(.search(q))
        scheduleRead(query: q, token: token)
    }

    func play(_ result: SearchResult) {
        player.source.send(.playSearchResult(index: result.index, videoID: result.videoID))
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 800_000_000)
            self.player.poll()
        }
    }

    // MARK: - Leitura dos resultados

    /// A página leva um instante para mostrar os resultados: tenta ler a cada 0,5 s.
    private func scheduleRead(query: String, token: Int) {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard token == self.token else { return }
            self.player.source.run(Scripts.searchResults) { result in
                let page: SearchPage
                if case .success(let output) = result {
                    page = Scripts.parseSearch(output)
                } else {
                    page = SearchPage(ready: false, query: "", items: [])
                }
                Task { @MainActor in self.handle(page, query: query, token: token) }
            }
        }
    }

    private func handle(_ page: SearchPage, query: String, token: Int) {
        guard token == self.token else { return }
        attempts += 1
        if page.ready, Self.sameQuery(page.query, query), !page.items.isEmpty {
            results = page.items
            phase = .done
            return
        }
        if attempts >= Self.maxAttempts {
            phase = .failed("Nenhum resultado (ou o YouTube Music demorou a responder).")
            return
        }
        scheduleRead(query: query, token: token)
    }

    private static func sameQuery(_ a: String, _ b: String) -> Bool {
        a.trimmingCharacters(in: .whitespaces).lowercased() == b.lowercased()
    }
}
