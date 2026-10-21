import AppKit

@main
@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private static var instance: AppDelegate?

    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        instance = delegate           // NSApplication guarda o delegate como referência fraca
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }

    private let player = PlayerModel()
    private var panel: PanelController?
    private var menuBar: MenuBarController?
    private var notch: NotchController?
    private var playlist: PlaylistController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMainMenu()
        let settings = Settings.shared
        let panel = PanelController(player: player, settings: settings)
        self.panel = panel
        notch = NotchController(player: player, settings: settings)
        playlist = PlaylistController(player: player, queue: QueueModel(player: player), settings: settings)
        menuBar = MenuBarController(player: player, settings: settings, panel: panel)
        if player.source.usesInternal {
            player.source.web.start()
            // Primeira vez com o player interno: mostra a janela para fazer login.
            if !UserDefaults.standard.bool(forKey: "internalWindowShown") {
                UserDefaults.standard.set(true, forKey: "internalWindowShown")
                player.source.web.showWindow()
            }
        }
        player.start()

        // Clique direito no notch ou na vitrola flutuante abre o menu.
        _ = NSEvent.addLocalMonitorForEvents(matching: [.rightMouseDown]) { event in
            guard event.window is VinylPanel else { return event }
            AppMenu.show()
            return nil
        }
    }

    /// Menu principal mínimo: sem ele, ⌘C / ⌘V / ⌘A / ⌘W não funcionam
    /// na janela do YouTube Music (ex.: colar a senha no login).
    private func installMainMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Sobre a Vitrola", action: #selector(showAbout), keyEquivalent: "").target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Ocultar Vitrola", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Sair da Vitrola", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Editar")
        edit.addItem(withTitle: "Desfazer", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Refazer", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Recortar", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copiar", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Colar", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Selecionar Tudo", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        main.addItem(editItem)

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Janela")
        windowMenu.addItem(withTitle: "Fechar", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowMenu.addItem(withTitle: "Minimizar", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowItem.submenu = windowMenu
        main.addItem(windowItem)

        NSApp.mainMenu = main
    }

    @objc private func showAbout() { Help.showAbout() }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        // Abrir a Vitrola de novo (Finder/Launchpad) mostra o YouTube Music.
        if player.source.usesInternal {
            player.source.web.showWindow()
        } else {
            panel?.show()
        }
        return false
    }
}
