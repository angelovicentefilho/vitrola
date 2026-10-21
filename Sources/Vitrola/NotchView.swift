import SwiftUI
import AppKit

/// Forma do notch: topo reto colado na tela, curvinhas para fora no topo
/// e cantos arredondados embaixo — igual ao recorte da câmera do MacBook.
struct NotchShape: Shape {
    var bottomRadius: CGFloat
    var flare: CGFloat

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(bottomRadius, flare) }
        set { bottomRadius = newValue.first; flare = newValue.second }
    }

    func path(in r: CGRect) -> Path {
        let t = flare
        let b = min(bottomRadius, (r.height - t) / 1.2)
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addQuadCurve(to: CGPoint(x: r.minX + t, y: r.minY + t), control: CGPoint(x: r.minX + t, y: r.minY))
        p.addLine(to: CGPoint(x: r.minX + t, y: r.maxY - b))
        p.addQuadCurve(to: CGPoint(x: r.minX + t + b, y: r.maxY), control: CGPoint(x: r.minX + t, y: r.maxY))
        p.addLine(to: CGPoint(x: r.maxX - t - b, y: r.maxY))
        p.addQuadCurve(to: CGPoint(x: r.maxX - t, y: r.maxY - b), control: CGPoint(x: r.maxX - t, y: r.maxY))
        p.addLine(to: CGPoint(x: r.maxX - t, y: r.minY + t))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: r.minY), control: CGPoint(x: r.maxX - t, y: r.minY))
        p.closeSubpath()
        return p
    }
}

struct NotchView: View {
    @ObservedObject var player: PlayerModel
    @ObservedObject var state: NotchState
    @ObservedObject var settings = Settings.shared

    private var m: NotchMetrics { state.metrics }

    var body: some View {
        let expanded = state.expanded
        let size = expanded ? m.expandedSize : m.collapsedSize
        let flare = NotchMetrics.flare

        ZStack(alignment: .top) {
            NotchShape(bottomRadius: expanded ? 26 : m.height * 0.32, flare: flare)
                .fill(Color.black)
                .frame(width: size.width + flare * 2, height: size.height)

            if expanded {
                expandedContent
                    .frame(width: size.width, height: size.height, alignment: .top)
                    .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .top)))
            } else {
                collapsedContent
                    .frame(width: size.width, height: size.height)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .animation(.spring(response: 0.38, dampingFraction: 0.82), value: expanded)
    }

    // MARK: - Recolhido: capa | câmera | equalizador

    private var collapsedContent: some View {
        HStack(spacing: 0) {
            Group {
                if player.track == nil && player.status.needsHelp {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: m.height * 0.42, weight: .semibold))
                        .foregroundColor(.yellow)
                } else if player.track == nil {
                    Image(systemName: "music.note")
                        .font(.system(size: m.height * 0.42, weight: .semibold))
                        .foregroundColor(.white.opacity(0.85))
                } else {
                    ArtworkThumb(image: player.artwork, size: m.height - 10, corner: 6)
                }
            }
            .frame(width: m.side, height: m.height)
            Color.clear.frame(width: m.notchWidth, height: m.height)
            Equalizer(playing: player.isPlaying, barCount: 4, height: m.height * 0.42)
                .frame(width: m.side, height: m.height)
        }
    }

    // MARK: - Expandido: vinil + informações + controles

    private var expandedContent: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: m.height)

            if let message = player.status.message, player.track == nil {
                VStack(spacing: 8) {
                    StatusPill(message: message, showHelp: player.status.needsHelp, maxWidth: m.expandedSize.width - 60)
                    HStack(spacing: 14) {
                        Button("Abrir YouTube Music") { player.source.openYouTubeMusic() }
                        Button("Menu da Vitrola") { AppMenu.show() }
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white.opacity(0.85))
                }
                .padding(.top, 18)
            } else {
            HStack(alignment: .center, spacing: 16) {
                TurntableView(player: player, diameter: 100, showArm: settings.showTonearm)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(player.track?.title ?? "")
                            .font(.system(size: 14, weight: .bold))
                            .lineLimit(1)
                        Spacer(minLength: 6)
                        Equalizer(playing: player.isPlaying, barCount: 4, height: 12)
                            .frame(width: 22, height: 12)
                    }
                    Text(player.track?.artist ?? "")
                        .font(.system(size: 12))
                        .opacity(0.7)
                        .lineLimit(1)

                    Spacer(minLength: 2)

                    ProgressBar(player: player)

                    HStack {
                        TransportControls(player: player, scale: 0.95)
                        Spacer()
                        Button {
                            player.toggleLike()
                        } label: {
                            Image(systemName: (player.track?.liked ?? false) ? "heart.fill" : "heart")
                                .font(.system(size: 14, weight: .semibold))
                                .frame(width: 26, height: 26)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .help("Curtir no YouTube Music")

                        Button {
                            settings.showPlaylist.toggle()
                        } label: {
                            Image(systemName: "list.bullet")
                                .font(.system(size: 13, weight: .bold))
                                .frame(width: 26, height: 26)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .help("Playlist (A seguir)")

                        Button {
                            AppMenu.show()
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.system(size: 14, weight: .bold))
                                .frame(width: 26, height: 26)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .help("Menu da Vitrola (ou clique direito)")
                    }
                }
                .frame(height: 100)
                .foregroundColor(.white)
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            }
        }
    }
}

struct ArtworkThumb: View {
    let image: NSImage?
    let size: CGFloat
    let corner: CGFloat

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image).resizable().interpolation(.high).scaledToFill()
            } else {
                ZStack {
                    LinearGradient(colors: [Color(red: 0.93, green: 0.36, blue: 0.24),
                                            Color(red: 0.72, green: 0.13, blue: 0.24)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                    Image(systemName: "music.note")
                        .font(.system(size: size * 0.45, weight: .bold))
                        .foregroundColor(.white)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }
}

/// Barrinhas que "dançam" enquanto toca e ficam baixinhas quando pausa.
struct Equalizer: View {
    let playing: Bool
    let barCount: Int
    let height: CGFloat

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 20.0, paused: !playing)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            HStack(alignment: .center, spacing: 2) {
                ForEach(0..<barCount, id: \.self) { i in
                    let phase = Double(i) * 1.7
                    let level: Double = playing
                        ? 0.35 + 0.65 * abs(sin(t * (5.0 + Double(i) * 1.3) + phase) * cos(t * 2.1 + phase))
                        : 0.22
                    Capsule()
                        .fill(Color.white.opacity(0.9))
                        .frame(width: 2.5, height: max(3, height * CGFloat(level)))
                }
            }
            .frame(height: height)
            .animation(.easeOut(duration: 0.12), value: playing)
        }
    }
}
