import AppKit
import ServiceManagement

/// Ícone na barra de menus com controles e preferências.
@MainActor
final class MenuBarController: NSObject, NSMenuDelegate {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private let player: PlayerModel
    private let settings: Settings
    private let panel: PanelController

    init(player: PlayerModel, settings: Settings, panel: PanelController) {
        self.player = player
        self.settings = settings
        self.panel = panel
        super.init()

        if let button = statusItem.button {
            let image = NSImage(systemSymbolName: "opticaldisc", accessibilityDescription: "Vitrola")
                ?? NSImage(systemSymbolName: "music.note", accessibilityDescription: "Vitrola")
            image?.isTemplate = true
            button.image = image
        }
        let menu = NSMenu()
        menu.autoenablesItems = false
        menu.delegate = self
        statusItem.menu = menu

        AppMenu.show = { [weak self] in self?.popUpAtMouse() }
    }

    /// Abre o mesmo menu no ponteiro do mouse.
    func popUpAtMouse() {
        let menu = NSMenu()
        menu.autoenablesItems = false
        menuNeedsUpdate(menu)
        menu.popUp(positioning: nil, at: NSEvent.mouseLocation, in: nil)
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()

        let header: String
        if let track = player.track {
            header = track.artist.isEmpty ? "♪ \(track.title)" : "♪ \(track.title) — \(track.artist)"
        } else {
            header = player.status.message ?? "Vitrola"
        }
        let headerItem = item(String(header.prefix(60)), nil)
        headerItem.isEnabled = false
        menu.addItem(headerItem)
        menu.addItem(.separator())

        let hasTrack = player.track != nil
        menu.addItem(item(player.isPlaying ? "Pausar" : "Tocar", #selector(playPause), enabled: hasTrack))
        menu.addItem(item("Próxima faixa", #selector(nextTrack), enabled: hasTrack))
        menu.addItem(item("Faixa anterior", #selector(previousTrack), enabled: hasTrack))
        menu.addItem(item((player.track?.liked ?? false) ? "Descurtir" : "Curtir", #selector(toggleLike), enabled: hasTrack))
        menu.addItem(.separator())

        menu.addItem(item("Mostrar no notch", #selector(toggleNotch), checked: settings.showNotch))
        menu.addItem(item("Vitrola flutuante na tela", #selector(togglePanel), checked: settings.showFloating))
        menu.addItem(item("Playlist (A seguir)", #selector(togglePlaylist), checked: settings.showPlaylist))
        menu.addItem(submenu("Visual", PlayerLayout.allCases.map { ($0.title, $0.rawValue, settings.layout == $0) }, #selector(setLayout(_:))))
        menu.addItem(submenu("Tamanho", PlayerSize.allCases.map { ($0.title, $0.rawValue, settings.size == $0) }, #selector(setSize(_:))))
        menu.addItem(submenu("Janela", WindowPlacement.allCases.map { ($0.title, $0.rawValue, settings.placement == $0) }, #selector(setPlacement(_:))))
        menu.addItem(item("Braço da agulha", #selector(toggleArm), checked: settings.showTonearm))
        menu.addItem(item("Cor da capa no fundo", #selector(toggleAlbumColor), checked: settings.albumColorBackground))
        menu.addItem(item("Barra de progresso", #selector(toggleProgress), checked: settings.showProgress))
        menu.addItem(submenu("Fonte da música", BrowserChoice.allCases.map { ($0.title, $0.rawValue, settings.browser == $0) }, #selector(setBrowser(_:))))
        menu.addItem(.separator())

        menu.addItem(item(player.source.usesInternal ? "Abrir janela do YouTube Music" : "Abrir YouTube Music no navegador",
                          #selector(openYouTubeMusic)))
        menu.addItem(item("Como configurar…", #selector(showHelp)))
        menu.addItem(item("Abrir ao iniciar sessão", #selector(toggleLogin), checked: SMAppService.mainApp.status == .enabled))
        menu.addItem(.separator())
        menu.addItem(item("Sobre a Vitrola", #selector(showAbout)))
        menu.addItem(item("Sair da Vitrola", #selector(quit), key: "q"))
    }

    // MARK: - Construção

    private func item(_ title: String, _ action: Selector?, key: String = "",
                      enabled: Bool = true, checked: Bool = false) -> NSMenuItem {
        let menuItem = NSMenuItem(title: title, action: action, keyEquivalent: key)
        menuItem.target = self
        menuItem.isEnabled = enabled
        menuItem.state = checked ? .on : .off
        return menuItem
    }

    private func submenu(_ title: String, _ options: [(String, String, Bool)], _ action: Selector) -> NSMenuItem {
        let parent = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        let sub = NSMenu()
        sub.autoenablesItems = false
        for (label, value, selected) in options {
            let option = item(label, action, checked: selected)
            option.representedObject = value
            sub.addItem(option)
        }
        parent.submenu = sub
        return parent
    }

    // MARK: - Ações

    @objc private func playPause() { player.playPause() }
    @objc private func nextTrack() { player.next() }
    @objc private func previousTrack() { player.previous() }
    @objc private func toggleLike() { player.toggleLike() }
    @objc private func togglePanel() { panel.toggle() }
    @objc private func toggleNotch() { settings.showNotch.toggle() }
    @objc private func togglePlaylist() { settings.showPlaylist.toggle() }
    @objc private func toggleArm() { settings.showTonearm.toggle() }
    @objc private func toggleAlbumColor() { settings.albumColorBackground.toggle() }
    @objc private func toggleProgress() { settings.showProgress.toggle() }
    @objc private func showHelp() { Help.showSetup() }
    @objc private func quit() { NSApp.terminate(nil) }
    @objc private func showAbout() { Help.showAbout() }

    @objc private func setLayout(_ sender: NSMenuItem) {
        if let raw = sender.representedObject as? String, let value = PlayerLayout(rawValue: raw) { settings.layout = value }
    }

    @objc private func setSize(_ sender: NSMenuItem) {
        if let raw = sender.representedObject as? String, let value = PlayerSize(rawValue: raw) { settings.size = value }
    }

    @objc private func setPlacement(_ sender: NSMenuItem) {
        if let raw = sender.representedObject as? String, let value = WindowPlacement(rawValue: raw) { settings.placement = value }
    }

    @objc private func setBrowser(_ sender: NSMenuItem) {
        if let raw = sender.representedObject as? String, let value = BrowserChoice(rawValue: raw) {
            settings.browser = value
            if value == .internal { player.source.web.showWindow() } else { player.source.web.pause() }
            player.poll()
        }
    }

    @objc private func openYouTubeMusic() { player.source.openYouTubeMusic() }

    @objc private func toggleLogin() {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            Help.alert("Não foi possível alterar o início automático", error.localizedDescription)
        }
    }
}
