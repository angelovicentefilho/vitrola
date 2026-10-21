import AppKit
import Carbon

/// Um navegador que a Vitrola sabe controlar via AppleScript.
struct BrowserTarget: Equatable {
    enum Kind { case chromium, safari }

    let appName: String      // nome usado no `tell application`
    let displayName: String  // nome mostrado ao usuário
    let bundleID: String
    let kind: Kind

    static let chrome = BrowserTarget(appName: "Google Chrome", displayName: "Chrome", bundleID: "com.google.Chrome", kind: .chromium)
    static let safari = BrowserTarget(appName: "Safari", displayName: "Safari", bundleID: "com.apple.Safari", kind: .safari)
    static let brave = BrowserTarget(appName: "Brave Browser", displayName: "Brave", bundleID: "com.brave.Browser", kind: .chromium)
    static let edge = BrowserTarget(appName: "Microsoft Edge", displayName: "Edge", bundleID: "com.microsoft.edgemac", kind: .chromium)
    static let arc = BrowserTarget(appName: "Arc", displayName: "Arc", bundleID: "company.thebrowser.Browser", kind: .chromium)

    static let all: [BrowserTarget] = [.chrome, .safari, .brave, .edge, .arc]
}

struct TrackSnapshot: Equatable {
    var title: String
    var artist: String
    var album: String
    var artworkURL: URL?
    var position: Double
    var duration: Double
    var isPlaying: Bool
    var liked: Bool
    var volume: Double? = nil      // 0–100, o valor do controle de volume do YouTube Music
}

enum BridgeError: Error, Equatable {
    case loading
    case browserNotRunning
    case tabNotFound
    case javascriptDisabled(String)
    case automationDenied(String)
    case other(String)
}

enum BridgeCommand {
    case playPause
    case next
    case previous
    case seek(Double)
    case toggleLike
    case playQueueItem(Int)
    case setVolume(Int)
    case search(String)
    case playSearchResult(index: Int, videoID: String)
}

/// Um resultado da busca do YouTube Music (música ou vídeo).
struct SearchResult: Identifiable, Equatable {
    let index: Int          // posição da linha na página de busca
    let videoID: String
    let title: String
    let subtitle: String    // ex.: "Música · Djavan"
    let thumbnailURL: URL?

    var id: String { "\(index)|\(videoID)" }
}

struct SearchPage: Equatable {
    let ready: Bool
    let query: String
    let items: [SearchResult]
}

/// Uma faixa da fila "A seguir" do YouTube Music.
struct QueueItem: Identifiable, Equatable {
    let index: Int          // posição no DOM, usada para mandar tocar
    let title: String
    let artist: String
    let duration: String
    let thumbnailURL: URL?
    let isCurrent: Bool

    var id: String { "\(index)|\(title)|\(artist)" }

    /// Duração em segundos a partir de "m:ss" ou "h:mm:ss".
    var seconds: Int {
        duration.split(separator: ":").reduce(0) { $0 * 60 + (Int($1) ?? 0) }
    }
}

/// Lê o estado do YouTube Music e envia comandos executando JavaScript
/// na aba music.youtube.com através de Apple Events.
/// Todo o trabalho roda numa fila serial própria para não travar a interface.
final class YouTubeMusicBridge {
    private let queue = DispatchQueue(label: "vitrola.bridge", qos: .userInitiated)

    // Acessados apenas dentro de `queue`.
    private var compiledState: [String: NSAppleScript] = [:]
    private var grantedBundles: Set<String> = []
    private var preferredBundle: String?

    private static let notPermitted = -1743

    func fetch(choice: BrowserChoice, running: Set<String>,
               completion: @escaping @Sendable (Result<TrackSnapshot, BridgeError>) -> Void) {
        queue.async {
            completion(self.fetchSync(choice: choice, running: running))
        }
    }

    func fetchQueue(choice: BrowserChoice, running: Set<String>,
                    completion: @escaping @Sendable (Result<[QueueItem], BridgeError>) -> Void) {
        queue.async {
            let result = self.runOnTab(js: Scripts.queue, choice: choice, running: running, cache: true)
            switch result {
            case .success(let output):
                completion(.success(Scripts.parseQueue(output)))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// Executa um JS qualquer na aba do YouTube Music e devolve a saída.
    func run(js: String, choice: BrowserChoice, running: Set<String>,
             completion: @escaping @Sendable (Result<String, BridgeError>) -> Void) {
        queue.async {
            completion(self.runOnTab(js: js, choice: choice, running: running, cache: false))
        }
    }

    func send(_ command: BridgeCommand, choice: BrowserChoice, running: Set<String>) {
        queue.async {
            let js = Scripts.js(for: command)
            for target in self.candidates(choice: choice, running: running) {
                if case .success(let out) = self.execute(js: js, on: target, cache: false), out != Scripts.noTab {
                    return
                }
            }
        }
    }

    // MARK: - Internals

    private func candidates(choice: BrowserChoice, running: Set<String>) -> [BrowserTarget] {
        var list = choice.targets.filter { running.contains($0.bundleID) }
        if let preferred = preferredBundle, let index = list.firstIndex(where: { $0.bundleID == preferred }) {
            list.insert(list.remove(at: index), at: 0)
        }
        return list
    }

    private func fetchSync(choice: BrowserChoice, running: Set<String>) -> Result<TrackSnapshot, BridgeError> {
        switch runOnTab(js: Scripts.state, choice: choice, running: running, cache: true) {
        case .success(let output):
            guard let snapshot = Scripts.parse(output) else {
                return .failure(.other("Resposta inesperada do navegador"))
            }
            return .success(snapshot)
        case .failure(let error):
            return .failure(error)
        }
    }

    /// Executa o JS na primeira aba do YouTube Music encontrada e devolve a saída.
    private func runOnTab(js: String, choice: BrowserChoice, running: Set<String>, cache: Bool) -> Result<String, BridgeError> {
        let list = candidates(choice: choice, running: running)
        if list.isEmpty { return .failure(.browserNotRunning) }

        var firstError: BridgeError?
        for target in list {
            switch execute(js: js, on: target, cache: cache) {
            case .success(let output):
                if output == Scripts.noTab { continue }
                preferredBundle = target.bundleID
                return .success(output)
            case .failure(let error):
                if firstError == nil { firstError = error }
            }
        }
        return .failure(firstError ?? .tabNotFound)
    }

    private func execute(js: String, on target: BrowserTarget, cache: Bool) -> Result<String, BridgeError> {
        if !ensurePermission(for: target) {
            return .failure(.automationDenied(target.displayName))
        }

        let source = Scripts.appleScript(for: target, js: js)
        let script: NSAppleScript
        if cache, let cached = compiledState[source] {
            script = cached
        } else {
            guard let fresh = NSAppleScript(source: source) else {
                return .failure(.other("Não foi possível montar o AppleScript"))
            }
            var compileError: NSDictionary?
            _ = fresh.compileAndReturnError(&compileError)
            if cache { compiledState[source] = fresh }
            script = fresh
        }

        var error: NSDictionary?
        let output = script.executeAndReturnError(&error)
        if let error {
            let number = error[NSAppleScript.errorNumber] as? Int ?? 0
            let message = error[NSAppleScript.errorMessage] as? String ?? ""
            if number == Self.notPermitted {
                grantedBundles.remove(target.bundleID)
                return .failure(.automationDenied(target.displayName))
            }
            if message.localizedCaseInsensitiveContains("javascript") {
                return .failure(.javascriptDisabled(target.displayName))
            }
            return .failure(.other(message.isEmpty ? "Erro \(number) no \(target.displayName)" : message))
        }
        return .success(output.stringValue ?? "")
    }

    /// Pede (uma vez) a permissão de Automação do macOS para controlar o navegador.
    /// Bloqueia a fila até o usuário responder ao diálogo do sistema.
    private func ensurePermission(for target: BrowserTarget) -> Bool {
        if grantedBundles.contains(target.bundleID) { return true }
        let descriptor = NSAppleEventDescriptor(bundleIdentifier: target.bundleID)
        guard let aeDesc = descriptor.aeDesc else { return true }
        let status = AEDeterminePermissionToAutomateTarget(
            aeDesc, AEEventClass(typeWildCard), AEEventID(typeWildCard), true
        )
        if status == 0 {
            grantedBundles.insert(target.bundleID)
            return true
        }
        return Int(status) != Self.notPermitted
    }
}

// MARK: - Scripts

enum Scripts {
    static let noTab = "__VITROLA_NO_TAB__"

    /// Lê título, artista, capa, posição e estado do player.
    static let state = compact(#"""
    (function(){
      var v = document.querySelector('video');
      var ms = navigator.mediaSession;
      var m = ms ? ms.metadata : null;
      function txt(s){ var e = document.querySelector(s); return e ? (e.getAttribute('title') || e.textContent || '').trim() : ''; }
      var title = (m && m.title) || txt('ytmusic-player-bar .title');
      var artist = (m && m.artist) || '';
      if (!artist) { artist = txt('ytmusic-player-bar .byline').split('•')[0].trim(); }
      var album = (m && m.album) || '';
      var art = '';
      if (m && m.artwork && m.artwork.length) {
        var best = m.artwork[0], bestSize = 0;
        for (var i = 0; i < m.artwork.length; i++) {
          var a = m.artwork[i];
          var size = parseInt(String(a.sizes || '0').split('x')[0], 10) || 0;
          if (size >= bestSize) { best = a; bestSize = size; }
        }
        art = best.src || '';
      }
      if (!art) { var im = document.querySelector('ytmusic-player-bar img'); if (im) { art = im.src || ''; } }
      var lk = document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer');
      var liked = lk ? lk.getAttribute('like-status') === 'LIKE' : false;
      var cur = v ? v.currentTime : 0;
      var dur = v ? v.duration : 0;
      if (!isFinite(dur)) { dur = 0; }
      var playing = v ? (!v.paused && !v.ended) : false;
      var vs = document.querySelector('ytmusic-player-bar #volume-slider');
      var vol = vs ? Number(vs.value) : (v ? Math.round(v.volume * 100) : null);
      return JSON.stringify({title: title, artist: artist, album: album, art: art, cur: cur, dur: dur, playing: playing, liked: liked, vol: vol});
    })()
    """#)

    /// Lê a fila "A seguir" (painel lateral do player do YouTube Music).
    /// Ignora as cópias escondidas em #counterpart-renderer (versão vídeo/música da mesma faixa).
    static let queue = compact(#"""
    (function(){
      var nodes = document.querySelectorAll('ytmusic-player-queue-item');
      var out = [];
      function t(n, sel){ var e = n.querySelector(sel); return e ? (e.getAttribute('title') || e.textContent || '').trim() : ''; }
      for (var i = 0; i < nodes.length && out.length < 300; i++) {
        var n = nodes[i];
        if (n.closest('#counterpart-renderer')) { continue; }
        var title = t(n, '.song-title');
        if (!title) { continue; }
        var by = t(n, '.byline').split('\u2022')[0].trim();
        var img = n.querySelector('.thumbnail img') || n.querySelector('img');
        var thumb = img ? (img.getAttribute('src') || '') : '';
        if (thumb.indexOf('data:') === 0) { thumb = ''; }
        var state = n.playButtonState || n.getAttribute('play-button-state') || '';
        var cur = n.selected === true || n.hasAttribute('selected') || state === 'playing' || state === 'paused';
        out.push({i: i, title: title, artist: by, dur: t(n, '.duration'), thumb: thumb, cur: cur});
      }
      return JSON.stringify(out);
    })()
    """#)

    /// Lê os resultados da página de busca (só linhas que tocam: músicas e vídeos).
    static let searchResults = compact(#"""
    (function(){
      var page = document.querySelector('ytmusic-search-page');
      var q = new URLSearchParams(location.search).get('q') || '';
      if (!page || location.pathname.indexOf('/search') !== 0) { return JSON.stringify({ready: false, q: q, items: []}); }
      var rows = page.querySelectorAll('ytmusic-responsive-list-item-renderer');
      var out = [];
      function t(n, sel){ var e = n.querySelector(sel); return e ? (e.getAttribute('title') || e.textContent || '').trim() : ''; }
      for (var i = 0; i < rows.length && out.length < 40; i++) {
        var n = rows[i];
        var a = n.querySelector('.title-column .title a[href*="watch?v="]') || n.querySelector('a[href*="watch?v="]');
        if (!a) { continue; }
        var m = (a.getAttribute('href') || '').match(/v=([^&]+)/);
        var sec = n.querySelectorAll('.secondary-flex-columns yt-formatted-string');
        var sub = '';
        for (var k = 0; k < sec.length; k++) { var s = (sec[k].getAttribute('title') || sec[k].textContent || '').trim(); if (s) { sub = s; break; } }
        var img = n.querySelector('img');
        var th = img ? (img.getAttribute('src') || '') : '';
        if (th.indexOf('data:') === 0) { th = ''; }
        out.push({i: i, id: m ? m[1] : '', title: t(n, '.title-column .title') || a.textContent.trim(), sub: sub, thumb: th});
      }
      return JSON.stringify({ready: rows.length > 0, q: q, items: out});
    })()
    """#)

    /// Converte texto em literal de string JavaScript (aspas e escapes corretos).
    static func jsString(_ text: String) -> String {
        guard let data = try? JSONEncoder().encode(text), let literal = String(data: data, encoding: .utf8) else { return "''" }
        return literal
    }

    static func js(for command: BridgeCommand) -> String {
        switch command {
        case .setVolume(let value):
            let v = String(min(max(value, 0), 100))
            return "(function(){ var v = " + v + "; "
                + "var s = document.querySelector('ytmusic-player-bar #volume-slider'); "
                + "var p = document.querySelector('#movie_player'); "
                + "if (s) { s.value = v; s.dispatchEvent(new CustomEvent('change', {bubbles: true})); } "
                + "else if (p && p.setVolume) { p.setVolume(v); } "
                + "if (p && p.isMuted && p.isMuted() && v > 0) { p.unMute(); } "
                + "return 'ok'; })()"
        case .search(let query):
            // Usa a caixa de busca do próprio YouTube Music: navega sem recarregar, a música não para.
            return "(function(){ var q = " + jsString(query) + "; "
                + "var box = document.querySelector('ytmusic-search-box'); "
                + "var i = box && (box.querySelector('input#input') || box.querySelector('input')); "
                + "if (!i) { location.href = '/search?q=' + encodeURIComponent(q); return 'nav'; } "
                + "i.focus(); i.value = q; i.dispatchEvent(new Event('input', {bubbles: true})); "
                + "var o = {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true}; "
                + "i.dispatchEvent(new KeyboardEvent('keydown', o)); i.dispatchEvent(new KeyboardEvent('keypress', o)); "
                + "i.dispatchEvent(new KeyboardEvent('keyup', o)); i.blur(); return 'ok'; })()"
        case .playSearchResult(let index, let videoID):
            let vid = jsString(videoID)
            return "(function(){ var vid = " + vid + "; "
                + "var n = document.querySelectorAll('ytmusic-search-page ytmusic-responsive-list-item-renderer')[" + String(index) + "]; "
                + "var a = n ? (n.querySelector('.title-column .title a[href*=\"watch?v=\"]') || n.querySelector('a[href*=\"watch?v=\"]')) : null; "
                + "if (a && (a.getAttribute('href') || '').indexOf(vid) >= 0) { a.click(); return 'ok'; } "
                + "location.href = '/watch?v=' + vid; return 'nav'; })()"
        case .playQueueItem(let index):
            return "(function(){ var n = document.querySelectorAll('ytmusic-player-queue-item')[" + String(index) + "]; "
                + "if (!n) { return 'no'; } "
                + "var b = n.querySelector('.song-info') || n; "
                + "['mousedown', 'mouseup', 'click'].forEach(function(t){ "
                + "b.dispatchEvent(new MouseEvent(t, {bubbles: true, cancelable: true, view: window})); }); "
                + "return 'ok'; })()"
        case .playPause:
            return compact(#"""
            (function(){
              var b = document.querySelector('ytmusic-player-bar #play-pause-button');
              if (b) { b.click(); return 'ok'; }
              var v = document.querySelector('video');
              if (v) { if (v.paused) { v.play(); } else { v.pause(); } }
              return 'ok';
            })()
            """#)
        case .next:
            return compact(#"""
            (function(){
              var b = document.querySelector('ytmusic-player-bar .next-button button') || document.querySelector('ytmusic-player-bar .next-button');
              if (b) { b.click(); }
              return 'ok';
            })()
            """#)
        case .previous:
            return compact(#"""
            (function(){
              var b = document.querySelector('ytmusic-player-bar .previous-button button') || document.querySelector('ytmusic-player-bar .previous-button');
              if (b) { b.click(); }
              return 'ok';
            })()
            """#)
        case .toggleLike:
            return compact(#"""
            (function(){
              var r = document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer');
              if (!r) { return 'ok'; }
              var b = r.querySelector('#button-shape-like button') || r.querySelector('.like');
              if (b) { b.click(); }
              return 'ok';
            })()
            """#)
        case .seek(let seconds):
            let s = String(format: "%.2f", max(0, seconds))
            return "(function(){ var p = document.querySelector('#movie_player'); "
                + "if (p && p.seekTo) { p.seekTo(" + s + ", true); return 'ok'; } "
                + "var v = document.querySelector('video'); if (v) { v.currentTime = " + s + "; } return 'ok'; })()"
        }
    }

    static func appleScript(for target: BrowserTarget, js: String) -> String {
        let escaped = js
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let run: String
        switch target.kind {
        case .chromium: run = "execute tb javascript \"\(escaped)\""
        case .safari: run = "do JavaScript \"\(escaped)\" in tb"
        }
        return """
        with timeout of 3 seconds
            tell application "\(target.appName)"
                repeat with w in windows
                    set tl to {}
                    try
                        set tl to tabs of w
                    end try
                    repeat with tb in tl
                        set u to ""
                        try
                            set u to (URL of tb) as text
                        end try
                        if u starts with "https://music.youtube.com" then
                            return \(run)
                        end if
                    end repeat
                end repeat
            end tell
        end timeout
        return "\(noTab)"
        """
    }

    private struct Raw: Decodable {
        let title: String?
        let artist: String?
        let album: String?
        let art: String?
        let cur: Double?
        let dur: Double?
        let playing: Bool?
        let liked: Bool?
        let vol: Double?
    }

    private struct RawQueueItem: Decodable {
        let i: Int
        let title: String?
        let artist: String?
        let dur: String?
        let thumb: String?
        let cur: Bool?
    }

    private struct RawSearch: Decodable {
        struct Item: Decodable { let i: Int; let id: String?; let title: String?; let sub: String?; let thumb: String? }
        let ready: Bool?
        let q: String?
        let items: [Item]?
    }

    static func parseSearch(_ output: String) -> SearchPage {
        guard let data = output.data(using: .utf8),
              let raw = try? JSONDecoder().decode(RawSearch.self, from: data) else {
            return SearchPage(ready: false, query: "", items: [])
        }
        let items: [SearchResult] = (raw.items ?? []).compactMap { item in
            guard let id = item.id, !id.isEmpty else { return nil }
            return SearchResult(index: item.i, videoID: id, title: item.title ?? "",
                                subtitle: (item.sub ?? "").replacingOccurrences(of: " \u{2022} ", with: " · "),
                                thumbnailURL: thumbnail(item.thumb))
        }
        return SearchPage(ready: raw.ready ?? false, query: raw.q ?? "", items: items)
    }

    static func parseQueue(_ output: String) -> [QueueItem] {
        guard let data = output.data(using: .utf8),
              let raw = try? JSONDecoder().decode([RawQueueItem].self, from: data) else { return [] }
        return raw.map {
            QueueItem(index: $0.i,
                      title: $0.title ?? "",
                      artist: $0.artist ?? "",
                      duration: $0.dur ?? "",
                      thumbnailURL: thumbnail($0.thumb),
                      isCurrent: $0.cur ?? false)
        }
    }

    /// Miniaturas da fila: pede um tamanho pequeno mas nítido.
    static func thumbnail(_ string: String?) -> URL? {
        guard var s = string, !s.isEmpty else { return nil }
        if let range = s.range(of: #"=w\d+-h\d+"#, options: .regularExpression) {
            s.replaceSubrange(range, with: "=w120-h120")
        }
        return URL(string: s)
    }

    static func parse(_ output: String) -> TrackSnapshot? {
        guard let data = output.data(using: .utf8),
              let raw = try? JSONDecoder().decode(Raw.self, from: data) else { return nil }
        return TrackSnapshot(
            title: raw.title ?? "",
            artist: raw.artist ?? "",
            album: raw.album ?? "",
            artworkURL: largeArtwork(raw.art),
            position: raw.cur ?? 0,
            duration: raw.dur ?? 0,
            isPlaying: raw.playing ?? false,
            liked: raw.liked ?? false,
            volume: raw.vol
        )
    }

    /// As capas do YouTube Music vêm como `...=w120-h120-...`; pedimos uma versão maior.
    static func largeArtwork(_ string: String?) -> URL? {
        guard var s = string, !s.isEmpty, !s.hasPrefix("data:") else { return nil }
        if let range = s.range(of: #"=w\d+-h\d+"#, options: .regularExpression) {
            s.replaceSubrange(range, with: "=w800-h800")
        }
        return URL(string: s)
    }

    private static func compact(_ js: String) -> String {
        js.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}
