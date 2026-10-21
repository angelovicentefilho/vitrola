import AppKit
import SwiftUI
import Combine

/// Medidas do notch na tela escolhida.
struct NotchMetrics: Equatable {
    var notchWidth: CGFloat
    var height: CGFloat

    var side: CGFloat { height + 10 }                 // largura de cada "asa" ao lado da câmera
    static let flare: CGFloat = 6                      // curvinha que encosta no topo da tela

    var collapsedSize: CGSize {
        CGSize(width: notchWidth + side * 2, height: height)
    }

    var expandedSize: CGSize {
        CGSize(width: max(collapsedSize.width + 40, 450), height: height + 134)
    }

    /// Tamanho da janela = forma + as curvinhas laterais.
    func windowSize(expanded: Bool) -> CGSize {
        let body = expanded ? expandedSize : collapsedSize
        return CGSize(width: body.width + Self.flare * 2, height: body.height)
    }

    @MainActor
    static func forScreen(_ screen: NSScreen) -> NotchMetrics {
        let notchHeight = screen.safeAreaInsets.top
        if notchHeight > 0,
           let left = screen.auxiliaryTopLeftArea,
           let right = screen.auxiliaryTopRightArea {
            let width = screen.frame.width - left.width - right.width
            return NotchMetrics(notchWidth: max(width, 0), height: notchHeight)
        }
        // Tela sem notch (monitor externo): uma pílula na altura da barra de menus.
        let menuBar = screen.frame.maxY - screen.visibleFrame.maxY
        return NotchMetrics(notchWidth: 90, height: max(menuBar, 24))
    }
}

@MainActor
final class NotchState: ObservableObject {
    @Published var expanded = false
    @Published var metrics = NotchMetrics(notchWidth: 180, height: 32)
}

/// Janela colada ao notch, acima da barra de menus.
@MainActor
final class NotchController {
    private let panel: VinylPanel
    private let player: PlayerModel
    private let settings: Settings
    private let state = NotchState()
    private var cancellables = Set<AnyCancellable>()
    private var mouseTimer: Timer?
    private var insideTicks = 0
    private var outsideTicks = 0
    private var collapseWork: DispatchWorkItem?

    init(player: PlayerModel, settings: Settings) {
        self.player = player
        self.settings = settings
        panel = VinylPanel(contentRect: NSRect(x: 0, y: 0, width: 300, height: 32),
                           styleMask: [.borderless, .nonactivatingPanel],
                           backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.level = NSWindow.Level(rawValue: NSWindow.Level.mainMenu.rawValue + 3)
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]

        let host = NSHostingView(rootView: NotchView(player: player, state: state))
        host.sizingOptions = []
        panel.contentView = host

        relayout()

        NotificationCenter.default.publisher(for: NSApplication.didChangeScreenParametersNotification)
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in self.relayout() }
            }
            .store(in: &cancellables)

        player.$track
            .map { $0 != nil }
            .removeDuplicates()
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in self.updateVisibility() }
            }
            .store(in: &cancellables)

        player.$status
            .map { $0.needsHelp }
            .removeDuplicates()
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in self.updateVisibility() }
            }
            .store(in: &cancellables)

        settings.objectWillChange
            .sink { [weak self] _ in
                guard let self else { return }
                Task { @MainActor in self.updateVisibility() }
            }
            .store(in: &cancellables)

        let timer = Timer(timeInterval: 0.08, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in self.trackMouse() }
        }
        RunLoop.main.add(timer, forMode: .common)
        mouseTimer = timer
    }

    // MARK: - Posição e visibilidade

    private var screen: NSScreen? {
        NSScreen.screens.first { $0.safeAreaInsets.top > 0 } ?? NSScreen.main
    }

    private func relayout() {
        guard let screen else { return }
        let metrics = NotchMetrics.forScreen(screen)
        if state.metrics != metrics { state.metrics = metrics }
        setWindowSize(expanded: state.expanded)
        updateVisibility()
    }

    private func setWindowSize(expanded: Bool) {
        guard let screen else { return }
        let size = state.metrics.windowSize(expanded: expanded)
        let frame = NSRect(x: screen.frame.midX - size.width / 2,
                           y: screen.frame.maxY - size.height,
                           width: size.width, height: size.height)
        panel.setFrame(frame, display: true)
    }

    private func updateVisibility() {
        // Aparece quando há música, ou quando falta liberar alguma permissão.
        let shouldShow = settings.showNotch && (player.track != nil || player.status.needsHelp)
        if shouldShow {
            if !panel.isVisible { panel.orderFrontRegardless() }
        } else {
            if state.expanded { state.expanded = false; setWindowSize(expanded: false) }
            panel.orderOut(nil)
        }
    }

    // MARK: - Expandir ao passar o mouse

    private func trackMouse() {
        guard panel.isVisible, let screen else { return }
        let mouse = NSEvent.mouseLocation
        let body = state.expanded ? state.metrics.expandedSize : state.metrics.collapsedSize
        let hotArea = NSRect(x: screen.frame.midX - body.width / 2 - 4,
                             y: screen.frame.maxY - body.height - 4,
                             width: body.width + 8,
                             height: body.height + 8)
        let inside = mouse.x >= hotArea.minX && mouse.x <= hotArea.maxX
            && mouse.y >= hotArea.minY && mouse.y <= hotArea.maxY

        if inside {
            outsideTicks = 0
            insideTicks += 1
            if !state.expanded && insideTicks >= 2 { expand() }
        } else {
            insideTicks = 0
            outsideTicks += 1
            if state.expanded && outsideTicks >= 4 { collapse() }
        }
    }

    private func expand() {
        collapseWork?.cancel()
        setWindowSize(expanded: true)
        state.expanded = true
    }

    private func collapse() {
        state.expanded = false
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            Task { @MainActor in
                if !self.state.expanded { self.setWindowSize(expanded: false) }
            }
        }
        collapseWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: work)
    }
}
