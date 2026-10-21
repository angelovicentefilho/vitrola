import AppKit

@MainActor
enum Help {
    static let automationSettings = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation")!

    static func showSetup() {
        let alert = NSAlert()
        alert.messageText = "Conectar a Vitrola ao YouTube Music"
        alert.informativeText = """
        A Vitrola lê a aba music.youtube.com do seu navegador. É preciso liberar duas coisas, uma vez só:

        1. JavaScript por Apple Events
        • Chrome / Brave / Edge: menu Visualizar › Desenvolvedor › Permitir JavaScript de Apple Events.
        • Safari: Ajustes › Avançado › marque “Mostrar recursos para desenvolvedores web”; depois menu Desenvolver › Permitir JavaScript de Apple Events.

        2. Permissão de Automação do macOS
        • Na primeira vez o macOS pergunta se a Vitrola pode controlar o navegador: clique em OK.
        • Se recusou sem querer: Ajustes do Sistema › Privacidade e Segurança › Automação › Vitrola › ative o navegador.

        Depois é só tocar algo no YouTube Music.
        """
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Abrir Automação")
        NSApp.activate(ignoringOtherApps: true)
        if alert.runModal() == .alertSecondButtonReturn {
            NSWorkspace.shared.open(automationSettings)
        }
    }

    static func showAbout() {
        let credits = NSMutableAttributedString(
            string: "Player de vinil para o YouTube Music, feito para uso pessoal.\n\n"
                + "Fica no notch e na barra de menus. Lê a aba music.youtube.com do navegador "
                + "via Apple Events. Nada sai do seu Mac.",
            attributes: [
                .font: NSFont.systemFont(ofSize: 11),
                .foregroundColor: NSColor.secondaryLabelColor
            ]
        )
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        credits.addAttribute(.paragraphStyle, value: paragraph, range: NSRange(location: 0, length: credits.length))

        NSApp.activate(ignoringOtherApps: true)
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "Vitrola",
            .credits: credits,
            NSApplication.AboutPanelOptionKey(rawValue: "Copyright"): "© 2026 Angelo Vicente Filho"
        ])
    }

    static func alert(_ title: String, _ text: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = text
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }
}
