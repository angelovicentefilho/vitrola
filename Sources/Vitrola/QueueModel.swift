import Foundation

/// Fila "A seguir" lida da aba do YouTube Music.
@MainActor
final class QueueModel: ObservableObject {
    @Published private(set) var items: [QueueItem] = []
    @Published private(set) var loaded = false
    @Published private(set) var error: BridgeError?

    private let player: PlayerModel
    private var inFlight = false

    init(player: PlayerModel) {
        self.player = player
    }

    var current: QueueItem? { items.first(where: \.isCurrent) }

    var totalSeconds: Int { items.reduce(0) { $0 + $1.seconds } }

    func refresh() {
        guard !inFlight else { return }
        inFlight = true
        player.bridge.fetchQueue(choice: Settings.shared.browser, running: player.runningBundles()) { [weak self] result in
            guard let self else { return }
            Task { @MainActor in
                self.inFlight = false
                self.loaded = true
                switch result {
                case .success(let items):
                    if self.items != items { self.items = items }
                    self.error = nil
                case .failure(let error):
                    self.error = error
                }
            }
        }
    }

    func play(_ item: QueueItem) {
        // Marca na hora para a interface responder, e confere logo depois.
        items = items.map {
            QueueItem(index: $0.index, title: $0.title, artist: $0.artist, duration: $0.duration,
                      thumbnailURL: $0.thumbnailURL, isCurrent: $0.id == item.id)
        }
        player.send(.playQueueItem(item.index))
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 900_000_000)
            self.refresh()
        }
    }
}
