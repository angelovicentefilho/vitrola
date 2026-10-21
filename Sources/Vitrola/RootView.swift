import SwiftUI
import AppKit

/// Medidas compartilhadas entre a view e o controlador da janela.
struct Metrics {
    let d: CGFloat
    let layout: PlayerLayout
    let pad: CGFloat = 14       // margem para a sombra
    let inner: CGFloat = 16     // respiro dentro do cartão
    let gap: CGFloat = 18

    @MainActor
    init(_ settings: Settings) {
        d = settings.size.discDiameter
        layout = settings.layout
    }

    var scale: CGFloat { d / 210 }
    var turntableWidth: CGFloat { d * 1.16 }
    var textWidth: CGFloat { max(190, d * 1.05) }

    var contentSize: CGSize {
        switch layout {
        case .disc:
            return CGSize(width: turntableWidth + pad * 2, height: d + pad * 2)
        case .card:
            return CGSize(width: pad * 2 + inner * 2 + turntableWidth + gap + textWidth,
                          height: pad * 2 + inner * 2 + d)
        }
    }
}

final class WindowBox {
    weak var window: NSWindow?
}

struct RootView: View {
    @ObservedObject var player: PlayerModel
    @ObservedObject var settings: Settings
    let box: WindowBox

    @State private var hovering = false

    var body: some View {
        let m = Metrics(settings)
        Group {
            switch settings.layout {
            case .disc: discLayout(m)
            case .card: cardLayout(m)
            }
        }
        .frame(width: m.contentSize.width, height: m.contentSize.height)
        .contentShape(Rectangle())
        .modifier(WindowDragger(box: box))
        .onHover { hovering = $0 }
        .animation(.easeInOut(duration: 0.2), value: hovering)
    }

    // MARK: - Só o disco

    private func discLayout(_ m: Metrics) -> some View {
        ZStack(alignment: .topLeading) {
            TurntableView(player: player, diameter: m.d, showArm: settings.showTonearm)

            ZStack {
                if let message = player.status.message {
                    StatusPill(message: message, showHelp: player.status.needsHelp, maxWidth: m.d * 0.86)
                } else if hovering {
                    VStack(spacing: 4) {
                        Text(nowPlayingLine)
                            .font(.system(size: 11 * max(m.scale, 0.85), weight: .semibold))
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .foregroundColor(.white)
                        TransportControls(player: player, scale: max(m.scale, 0.8) * 0.85)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(maxWidth: m.d * 0.82)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.black.opacity(0.62)))
                    .transition(.opacity)
                }
            }
            .frame(width: m.d, height: m.d)
        }
        .padding(m.pad)
    }

    // MARK: - Cartão

    private func cardLayout(_ m: Metrics) -> some View {
        let s = m.scale
        return HStack(alignment: .center, spacing: m.gap) {
            TurntableView(player: player, diameter: m.d, showArm: settings.showTonearm)

            VStack(alignment: .leading, spacing: 4 * s) {
                Text(player.track?.title ?? "Vitrola")
                    .font(.system(size: 15 * s, weight: .bold))
                    .lineLimit(2)
                Text(player.track?.artist ?? "YouTube Music")
                    .font(.system(size: 12 * s))
                    .opacity(0.75)
                    .lineLimit(1)
                if let album = player.track?.album, !album.isEmpty {
                    Text(album)
                        .font(.system(size: 12 * s))
                        .opacity(0.55)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                if let message = player.status.message {
                    StatusPill(message: message, showHelp: player.status.needsHelp, maxWidth: m.textWidth)
                } else if settings.showProgress {
                    ProgressBar(player: player)
                }

                HStack {
                    TransportControls(player: player, scale: s)
                    Spacer()
                    Button {
                        player.toggleLike()
                    } label: {
                        Image(systemName: (player.track?.liked ?? false) ? "heart.fill" : "heart")
                            .font(.system(size: 14 * s, weight: .semibold))
                            .frame(width: 26 * s, height: 26 * s)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .help("Curtir no YouTube Music")

                    Button {
                        settings.showPlaylist.toggle()
                    } label: {
                        Image(systemName: "list.bullet")
                            .font(.system(size: 13 * s, weight: .bold))
                            .frame(width: 24 * s, height: 26 * s)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .help("Playlist (A seguir)")

                    Button {
                        AppMenu.show()
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 13 * s, weight: .bold))
                            .frame(width: 24 * s, height: 26 * s)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .help("Menu da Vitrola (ou clique direito)")
                }
                .padding(.top, 2)
            }
            .frame(width: m.textWidth, height: m.d, alignment: .leading)
            .foregroundColor(.white)
        }
        .padding(m.inner)
        .background(CardBackground(player: player, useAlbumColor: settings.albumColorBackground))
        .clipShape(RoundedRectangle(cornerRadius: 22 * s, style: .continuous))
        .shadow(color: .black.opacity(0.35), radius: 10, x: 0, y: 6)
        .padding(m.pad)
    }

    private var nowPlayingLine: String {
        guard let track = player.track else { return "YouTube Music" }
        return track.artist.isEmpty ? track.title : "\(track.title) — \(track.artist)"
    }
}

// MARK: - Peças

struct TransportControls: View {
    @ObservedObject var player: PlayerModel
    var scale: CGFloat

    var body: some View {
        HStack(spacing: 10 * scale) {
            control("backward.fill", 15, help: "Faixa anterior") { player.previous() }
            control(player.isPlaying ? "pause.fill" : "play.fill", 22, help: "Tocar / Pausar") { player.playPause() }
            control("forward.fill", 15, help: "Próxima faixa") { player.next() }
        }
        .foregroundColor(.white)
    }

    private func control(_ symbol: String, _ size: CGFloat, help: String, action: @escaping @MainActor () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size * scale, weight: .semibold))
                .frame(width: (size + 12) * scale, height: (size + 12) * scale)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

struct ProgressBar: View {
    @ObservedObject var player: PlayerModel
    @State private var dragFraction: Double?

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { context in
            let duration = player.track?.duration ?? 0
            let position = player.position(at: context.date)
            let fraction = dragFraction ?? (duration > 0 ? position / duration : 0)

            VStack(spacing: 3) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.25)).frame(height: 4)
                        Capsule().fill(Color.white)
                            .frame(width: max(4, geo.size.width * CGFloat(fraction)), height: 4)
                    }
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                dragFraction = Self.clamp(value.location.x / max(geo.size.width, 1))
                            }
                            .onEnded { value in
                                let f = Self.clamp(value.location.x / max(geo.size.width, 1))
                                dragFraction = nil
                                if duration > 0 { player.seek(to: f * duration) }
                            }
                    )
                }
                .frame(height: 12)

                HStack {
                    Text(Self.format(dragFraction.map { $0 * duration } ?? position))
                    Spacer()
                    Text(Self.format(duration))
                }
                .font(.system(size: 10, weight: .medium).monospacedDigit())
                .opacity(0.7)
            }
        }
    }

    private static func clamp(_ value: CGFloat) -> Double {
        Double(min(max(value, 0), 1))
    }

    private static func format(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0:00" }
        let total = Int(seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

struct StatusPill: View {
    let message: String
    let showHelp: Bool
    let maxWidth: CGFloat

    var body: some View {
        VStack(spacing: 6) {
            Text(message)
                .font(.system(size: 11, weight: .medium))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if showHelp {
                Button("Como resolver") { Help.showSetup() }
                    .buttonStyle(.plain)
                    .font(.system(size: 11, weight: .semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color.white.opacity(0.2)))
            }
        }
        .foregroundColor(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: maxWidth)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.black.opacity(0.62)))
    }
}

struct CardBackground: View {
    @ObservedObject var player: PlayerModel
    let useAlbumColor: Bool

    var body: some View {
        ZStack {
            if useAlbumColor {
                LinearGradient(colors: [player.accent, Color(white: 0.07)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                if let artwork = player.artwork {
                    Image(nsImage: artwork)
                        .resizable()
                        .scaledToFill()
                        .blur(radius: 30)
                        .opacity(0.4)
                }
            } else {
                Color(white: 0.1)
            }
        }
        .animation(.easeInOut(duration: 0.6), value: player.accent)
    }
}

/// Arrastar a janela por qualquer parte que não seja um botão.
struct WindowDragger: ViewModifier {
    let box: WindowBox
    @State private var start: (mouse: NSPoint, origin: NSPoint)?

    func body(content: Content) -> some View {
        content.gesture(
            DragGesture(minimumDistance: 2)
                .onChanged { _ in
                    guard let window = box.window else { return }
                    let mouse = NSEvent.mouseLocation
                    if start == nil { start = (mouse, window.frame.origin) }
                    guard let start else { return }
                    window.setFrameOrigin(NSPoint(x: start.origin.x + mouse.x - start.mouse.x,
                                                  y: start.origin.y + mouse.y - start.mouse.y))
                }
                .onEnded { _ in start = nil }
        )
    }
}
