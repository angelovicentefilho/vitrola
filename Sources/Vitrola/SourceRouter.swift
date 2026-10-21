import AppKit

/// Decide de onde vem a música: o player interno (padrão) ou uma aba de navegador.
/// Os mesmos scripts de `Scripts` rodam nos dois casos.
@MainActor
final class SourceRouter {
    let bridge = YouTubeMusicBridge()
    let web = WebPlayer()

    var usesInternal: Bool { Settings.shared.browser == .internal }

    func fetchState(completion: @escaping @Sendable (Result<TrackSnapshot, BridgeError>) -> Void) {
        if usesInternal {
            web.evaluate(Scripts.state) { result in
                switch result {
                case .success(let output):
                    // Página fora do player (login, carregando): trata como "nada tocando".
                    completion(.success(Scripts.parse(output) ?? Self.empty))
                case .failure(let error):
                    completion(.failure(error))
                }
            }
        } else {
            bridge.fetch(choice: Settings.shared.browser, running: runningBundles(), completion: completion)
        }
    }

    func fetchQueue(completion: @escaping @Sendable (Result<[QueueItem], BridgeError>) -> Void) {
        if usesInternal {
            web.evaluate(Scripts.queue) { result in
                switch result {
                case .success(let output): completion(.success(Scripts.parseQueue(output)))
                case .failure(let error): completion(.failure(error))
                }
            }
        } else {
            bridge.fetchQueue(choice: Settings.shared.browser, running: runningBundles(), completion: completion)
        }
    }

    func send(_ command: BridgeCommand) {
        if usesInternal {
            web.evaluate(Scripts.js(for: command)) { _ in }
        } else {
            bridge.send(command, choice: Settings.shared.browser, running: runningBundles())
        }
    }

    /// Abre o YouTube Music: a janela interna ou o navegador escolhido.
    func openYouTubeMusic() {
        if usesInternal {
            web.showWindow()
            return
        }
        let url = WebPlayer.home
        if let target = Settings.shared.browser.targets.first, Settings.shared.browser != .auto,
           let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: target.bundleID) {
            NSWorkspace.shared.open([url], withApplicationAt: appURL, configuration: NSWorkspace.OpenConfiguration())
        } else {
            NSWorkspace.shared.open(url)
        }
    }

    private func runningBundles() -> Set<String> {
        Set(NSWorkspace.shared.runningApplications.compactMap { $0.bundleIdentifier })
    }

    private static let empty = TrackSnapshot(title: "", artist: "", album: "", artworkURL: nil,
                                             position: 0, duration: 0, isPlaying: false, liked: false)
}
