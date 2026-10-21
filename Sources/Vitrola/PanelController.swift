import AppKit
import SwiftUI
import Combine

final class VinylPanel: NSPanel {
    /// Rolar o mouse sobre esta janela ajusta o volume (notch e vitrola flutuante).
    var scrollsVolume = false
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
    // Permite a janela do notch ficar por cima da barra de menus.
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect { frameRect }
}

/// Janela flutuante sem bordas que mostra a vitrola.
@MainActor
final class PanelController {
    private let panel: VinylPanel
    private let settings: Settings
    private let box = WindowBox()
    private var cancellables = Set<AnyCancellable>()
    private static let originKey = "panelOrigin"

    var isVisible: Bool { panel.isVisible }

    init(player: PlayerModel, settings: Settings) {
        self.settings = settings
        panel = VinylPanel(contentRect: NSRect(x: 0, y: 0, width: 300, height: 300),
                           styleMask: [.borderless, .nonactivatingPanel],
                           backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.title = "Vitrola"
        panel.scrollsVolume = true
        box.window = panel

        let host = NSHostingView(rootView: RootView(player: player, settings: settings, box: box))
        host.sizingOptions = []
        panel.contentView = host

        applySettings()
        restoreOrigin()

        settings.objectWillChange
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in self.applySettings() }
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: NSWindow.didMoveNotification, object: panel)
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in self.saveOrigin() }
            }
            .store(in: &cancellables)
    }

    func show() { settings.showFloating = true }
    func toggle() { settings.showFloating.toggle() }

    private func applySettings() {
        switch settings.placement {
        case .front:
            panel.level = .floating
            panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        case .normal:
            panel.level = .normal
            panel.collectionBehavior = [.canJoinAllSpaces]
        case .desktop:
            panel.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
            panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        }
        resizeKeepingTop()
        if settings.showFloating {
            if !panel.isVisible { panel.orderFrontRegardless() }
        } else if panel.isVisible {
            panel.orderOut(nil)
        }
    }

    /// Ajusta o tamanho mantendo o canto superior esquerdo no lugar.
    private func resizeKeepingTop() {
        let size = Metrics(settings).contentSize
        var frame = panel.frame
        guard frame.size != size else { return }
        let top = frame.maxY
        frame.size = size
        frame.origin.y = top - size.height
        panel.setFrame(frame, display: true)
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
        panel.setFrameOrigin(NSPoint(x: visible.maxX - size.width - 20, y: visible.maxY - size.height - 20))
    }
}
