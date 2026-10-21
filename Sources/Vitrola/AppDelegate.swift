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

    func applicationDidFinishLaunching(_ notification: Notification) {
        let settings = Settings.shared
        let panel = PanelController(player: player, settings: settings)
        self.panel = panel
        notch = NotchController(player: player, settings: settings)
        menuBar = MenuBarController(player: player, settings: settings, panel: panel)
        player.start()

        // Clique direito no notch ou na vitrola flutuante abre o menu.
        _ = NSEvent.addLocalMonitorForEvents(matching: [.rightMouseDown]) { event in
            guard event.window is VinylPanel else { return event }
            AppMenu.show()
            return nil
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        panel?.show()
        return false
    }
}
