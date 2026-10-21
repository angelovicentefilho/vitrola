import AppKit
import WebKit

/// YouTube Music rodando dentro da própria Vitrola, sem Chrome nem Safari.
/// O login fica salvo no armazenamento do app (WKWebsiteDataStore padrão).
/// A janela pode ficar escondida: a música continua tocando.
@MainActor
final class WebPlayer: NSObject, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    static let home = URL(string: "https://music.youtube.com")!
    /// Identifica-se como Safari: o Google bloqueia login em navegadores "desconhecidos".
    static let userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15"

    private var webView: WKWebView?
    private var window: NSWindow?
    private var hasLoadedOnce = false

    var isWindowVisible: Bool { window?.isVisible ?? false }

    /// Cria a web view e carrega o YouTube Music (uma vez só).
    func start() {
        guard webView == nil else { return }

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        let frame = NSRect(x: 0, y: 0, width: 1100, height: 760)
        let web = WKWebView(frame: frame, configuration: config)
        web.customUserAgent = Self.userAgent
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true

        let win = NSWindow(contentRect: frame,
                           styleMask: [.titled, .closable, .miniaturizable, .resizable],
                           backing: .buffered, defer: false)
        win.title = "YouTube Music — Vitrola"
        win.isReleasedWhenClosed = false
        win.delegate = self
        win.contentView = web
        win.minSize = NSSize(width: 520, height: 420)
        win.center()
        win.setFrameAutosaveName("VitrolaYouTubeMusic")
        win.collectionBehavior = [.moveToActiveSpace]

        webView = web
        window = win
        web.load(URLRequest(url: Self.home))
    }

    func showWindow() {
        start()
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
    }

    func toggleWindow() {
        if isWindowVisible { window?.orderOut(nil) } else { showWindow() }
    }

    /// Fechar a janela só esconde — a música continua.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    /// Pausa o player interno (ao trocar para um navegador, para não tocar em dobro).
    func pause() {
        guard webView != nil else { return }
        evaluate("(function(){ var v = document.querySelector('video'); if (v) { v.pause(); } return 'ok'; })()") { _ in }
    }

    /// Executa um dos scripts da Vitrola na página do YouTube Music.
    func evaluate(_ js: String, completion: @escaping (Result<String, BridgeError>) -> Void) {
        start()
        guard let webView, hasLoadedOnce else {
            completion(.failure(.loading))
            return
        }
        guard webView.url?.host == "music.youtube.com" else {
            // Ex.: na tela de login do Google.
            completion(.success(""))
            return
        }
        webView.evaluateJavaScript(js) { result, error in
            if let error {
                completion(.failure(.other(error.localizedDescription)))
            } else {
                completion(.success(result as? String ?? ""))
            }
        }
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasLoadedOnce = true
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        hasLoadedOnce = true
    }

    /// Falhou antes de carregar (ex.: Mac sem internet ao abrir): tenta de novo em 5 s.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard !hasLoadedOnce else { return }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            if !self.hasLoadedOnce { self.webView?.load(URLRequest(url: Self.home)) }
        }
    }

    /// O processo da página caiu: recarrega para a música voltar.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: - WKUIDelegate

    /// Links que abririam outra janela (ex.: login) abrem na mesma.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        let host = url.host ?? ""
        if host.hasSuffix("youtube.com") || host.hasSuffix("google.com") {
            webView.load(URLRequest(url: url))      // login e páginas do YouTube Music
        } else {
            NSWorkspace.shared.open(url)            // links externos vão para o navegador padrão
        }
        return nil
    }
}
