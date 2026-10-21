import AppKit
import SwiftUI
import CoreImage

enum PlayerStatus: Equatable {
    case connecting
    case ok
    case idle
    case error(BridgeError)

    var message: String? {
        switch self {
        case .ok: return nil
        case .connecting: return "Conectando ao YouTube Music…"
        case .idle: return "Nada tocando no YouTube Music"
        case .error(let error):
            switch error {
            case .browserNotRunning: return "Abra o YouTube Music no navegador"
            case .tabNotFound: return "Abra music.youtube.com em uma aba"
            case .javascriptDisabled(let browser): return "Ative “Permitir JavaScript de Apple Events” no \(browser)"
            case .automationDenied(let browser): return "Permita que a Vitrola controle o \(browser)"
            case .other(let text): return text
            }
        }
    }

    var needsHelp: Bool {
        guard case .error(let error) = self else { return false }
        switch error {
        case .javascriptDisabled, .automationDenied: return true
        default: return false
        }
    }
}

/// Mantém o ângulo do disco contínuo entre play/pause (33⅓ rpm = 200°/s).
final class SpinClock {
    private var base: Double = 0
    private var since: Date?

    func angle(at date: Date) -> Double {
        var value = base
        if let since { value += date.timeIntervalSince(since) * 200 }
        return value.truncatingRemainder(dividingBy: 360)
    }

    func set(playing: Bool) {
        let now = Date()
        if playing {
            if since == nil { since = now }
        } else if since != nil {
            base = angle(at: now)
            since = nil
        }
    }
}

@MainActor
final class PlayerModel: ObservableObject {
    @Published private(set) var track: TrackSnapshot?
    @Published private(set) var status: PlayerStatus = .connecting
    @Published private(set) var artwork: NSImage?
    @Published private(set) var accent: Color = Color(white: 0.16)

    let spin = SpinClock()

    let bridge = YouTubeMusicBridge()
    private var timer: Timer?
    private var inFlight = false
    private var pollAgain = false
    private var failureStreak = 0
    private var anchorPosition: Double = 0
    private var anchorDate = Date()
    private var artworkURL: URL?
    private var artworkCache: [URL: (NSImage, NSColor)] = [:]

    var isPlaying: Bool { track?.isPlaying ?? false }

    func start() {
        timer?.invalidate()
        let t = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in self.poll() }
        }
        RunLoop.main.add(t, forMode: .common)   // continua rodando com o menu aberto
        timer = t
        poll()
    }

    func poll() {
        guard !inFlight else { pollAgain = true; return }
        inFlight = true
        bridge.fetch(choice: Settings.shared.browser, running: runningBundles()) { [weak self] result in
            guard let self else { return }
            Task { @MainActor in
                self.inFlight = false
                self.apply(result)
                if self.pollAgain { self.pollAgain = false; self.poll() }
            }
        }
    }

    /// Posição estimada agora, interpolando entre as leituras do navegador.
    func position(at date: Date) -> Double {
        guard let track else { return 0 }
        var value = anchorPosition
        if track.isPlaying { value += date.timeIntervalSince(anchorDate) }
        return track.duration > 0 ? min(max(value, 0), track.duration) : max(value, 0)
    }

    // MARK: - Comandos

    func playPause() {
        if var t = track {
            anchorPosition = position(at: Date())
            anchorDate = Date()
            t.isPlaying.toggle()
            track = t
            spin.set(playing: t.isPlaying)
        }
        send(.playPause)
    }

    func next() { send(.next) }
    func previous() { send(.previous) }

    func seek(to seconds: Double) {
        anchorPosition = seconds
        anchorDate = Date()
        if var t = track { t.position = seconds; track = t }
        send(.seek(seconds))
    }

    func toggleLike() {
        if var t = track { t.liked.toggle(); track = t }
        send(.toggleLike)
    }

    func send(_ command: BridgeCommand) {
        bridge.send(command, choice: Settings.shared.browser, running: runningBundles())
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 400_000_000)
            self.poll()
        }
    }

    // MARK: - Estado

    func runningBundles() -> Set<String> {
        Set(NSWorkspace.shared.runningApplications.compactMap { $0.bundleIdentifier })
    }

    private func apply(_ result: Result<TrackSnapshot, BridgeError>) {
        switch result {
        case .success(let snapshot):
            failureStreak = 0
            guard !snapshot.title.isEmpty else {
                if track != nil { track = nil }
                status = .idle
                spin.set(playing: false)
                loadArtwork(nil)
                return
            }
            anchorPosition = snapshot.position
            anchorDate = Date()
            if track != snapshot { track = snapshot }
            if status != .ok { status = .ok }
            spin.set(playing: snapshot.isPlaying)
            if snapshot.artworkURL != artworkURL { loadArtwork(snapshot.artworkURL) }
        case .failure(let error):
            // Uma falha isolada (ex.: navegador ocupado) não deve apagar o notch.
            failureStreak += 1
            let definitive: Bool
            switch error {
            case .other: definitive = false
            default: definitive = true
            }
            if !definitive && failureStreak < 3 && track != nil { return }
            if status != .error(error) { status = .error(error) }
            if track != nil { track = nil }
            spin.set(playing: false)
            loadArtwork(nil)
        }
    }

    private func loadArtwork(_ url: URL?) {
        guard url != artworkURL || (url == nil && artwork != nil) else { return }
        artworkURL = url
        guard let url else {
            artwork = nil
            accent = Color(white: 0.16)
            return
        }
        if let cached = artworkCache[url] {
            artwork = cached.0
            accent = Color(nsColor: cached.1)
            return
        }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data, let image = NSImage(data: data) else { return }
            let color = ArtworkColor.background(from: data)
            Task { @MainActor in self.finishArtwork(url: url, image: image, color: color) }
        }.resume()
    }

    private func finishArtwork(url: URL, image: NSImage, color: NSColor) {
        artworkCache[url] = (image, color)
        if artworkCache.count > 40 { artworkCache.removeAll() }
        guard url == artworkURL else { return }
        artwork = image
        accent = Color(nsColor: color)
    }
}

/// Cor média da capa, escurecida para o texto branco continuar legível.
enum ArtworkColor {
    static func background(from data: Data) -> NSColor {
        let fallback = NSColor(white: 0.16, alpha: 1)
        guard let image = CIImage(data: data),
              let filter = CIFilter(name: "CIAreaAverage", parameters: [
                kCIInputImageKey: image,
                kCIInputExtentKey: CIVector(cgRect: image.extent)
              ]),
              let output = filter.outputImage else { return fallback }

        var pixel = [UInt8](repeating: 0, count: 4)
        let context = CIContext(options: [.workingColorSpace: NSNull()])
        context.render(output, toBitmap: &pixel, rowBytes: 4,
                       bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
                       format: .RGBA8, colorSpace: nil)

        let color = NSColor(srgbRed: CGFloat(pixel[0]) / 255,
                            green: CGFloat(pixel[1]) / 255,
                            blue: CGFloat(pixel[2]) / 255, alpha: 1)
        let brightness = color.brightnessComponent
        let fraction = brightness > 0.55 ? 0.55 : 0.35
        return color.blended(withFraction: fraction, of: .black) ?? color
    }
}
