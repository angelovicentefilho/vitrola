import AppKit
import SwiftUI
import Combine

/// Janela flutuante da playlist ("A seguir").
@MainActor
final class PlaylistController {
    private let panel: VinylPanel
    private let queue: QueueModel
    private let settings: Settings
    private let box = WindowBox()
    private var cancellables = Set<AnyCancellable>()
    private var timer: Timer?
    private static let originKey = "playlistOrigin"

    init(player: PlayerModel, queue: QueueModel, settings: Settings) {
        self.queue = queue
        self.settings = settings

        let size = CGSize(width: PlaylistView.size.width + PlaylistView.pad * 2,
                          height: PlaylistView.size.height + PlaylistView.pad * 2)
        panel = VinylPanel(contentRect: NSRect(origin: .zero, size: size),
                           styleMask: [.borderless, .nonactivatingPanel],
                           backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.title = "Vitrola – A seguir"
        box.window = panel

        let host = NSHostingView(rootView: PlaylistView(queue: queue, player: player, box: box))
        host.sizingOptions = []
        panel.contentView = host

        restoreOrigin()
        apply()

        settings.objectWillChange
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in self.apply() }
            }
            .store(in: &cancellables)

        // Música nova → a fila muda: relê logo em seguida.
        player.$track
            .map { track -> String? in
                guard let track else { return nil }
                return "\(track.title)|\(track.artist)"
            }
            .removeDuplicates()
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 600_000_000)
                    if self.panel.isVisible { self.queue.refresh() }
                }
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: NSWindow.didMoveNotification, object: panel)
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in self.saveOrigin() }
            }
            .store(in: &cancellables)
    }

    private func apply() {
        if settings.showPlaylist {
            guard !panel.isVisible else { return }
            panel.orderFrontRegardless()
            queue.refresh()
            startTimer()
        } else if panel.isVisible {
            panel.orderOut(nil)
            timer?.invalidate()
            timer = nil
        }
    }

    /// Enquanto a janela está aberta, relê a fila a cada 4 s.
    private func startTimer() {
        timer?.invalidate()
        let t = Timer(timeInterval: 4, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in self.queue.refresh() }
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func saveOrigin() {
        UserDefaults.standard.set(NSStringFromPoint(panel.frame.origin), forKey: Self.originKey)
    }

    private func restoreOrigin() {
        let size = panel.frame.size
        if let saved = UserDefaults.standard.string(forKey: Self.originKey) {
            let origin = NSPointFromString(saved)
            let rect = NSRect(origin: origin, size: size)
            if NSScreen.screens.contains(where: { $0.visibleFrame.intersects(rect.insetBy(dx: 40, dy: 40)) }) {
                panel.setFrameOrigin(origin)
                return
            }
        }
        guard let screen = NSScreen.main else { return }
        let visible = screen.visibleFrame
        panel.setFrameOrigin(NSPoint(x: visible.maxX - size.width - 16, y: visible.maxY - size.height - 16))
    }
}
