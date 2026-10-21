import SwiftUI
import AppKit

/// Toca-discos: disco girando + braço da agulha.
/// Ocupa um quadro de (1.16 × d) por d — o braço fica à direita do disco.
struct TurntableView: View {
    @ObservedObject var player: PlayerModel
    let diameter: CGFloat
    let showArm: Bool

    var body: some View {
        let d = diameter
        ZStack(alignment: .topLeading) {
            TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: !player.isPlaying)) { context in
                VinylDisc(diameter: d, artwork: player.artwork)
                    .rotationEffect(.degrees(player.spin.angle(at: context.date)))
            }
            .frame(width: d, height: d)
            .overlay(DiscSheen().allowsHitTesting(false))
            .shadow(color: .black.opacity(0.45), radius: d * 0.045, x: 0, y: d * 0.02)

            if showArm {
                Tonearm(diameter: d, angle: armAngle)
            }

            if player.showVolumeHUD {
                VolumeHUD(volume: player.volume, diameter: d)
                    .frame(width: d, height: d)
                    .transition(.opacity)
                    .allowsHitTesting(false)
            }
        }
        .frame(width: d * 1.16, height: d, alignment: .topLeading)
        .animation(.easeOut(duration: 0.15), value: player.showVolumeHUD)
    }

    private var armAngle: Double {
        guard let track = player.track, track.isPlaying else { return Tonearm.restAngle }
        let progress = track.duration > 0 ? min(max(track.position / track.duration, 0), 1) : 0
        return Tonearm.startAngle + (Tonearm.endAngle - Tonearm.startAngle) * progress
    }
}

struct VinylDisc: View {
    let diameter: CGFloat
    let artwork: NSImage?

    var body: some View {
        let d = diameter
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [Color(white: 0.14), Color(white: 0.06), Color(white: 0.02)],
                                     center: .center, startRadius: 0, endRadius: d / 2))

            ForEach(0..<15, id: \.self) { i in
                Circle()
                    .stroke(Color.white.opacity(i % 4 == 0 ? 0.08 : 0.035), lineWidth: 0.6)
                    .frame(width: d * (0.40 + CGFloat(i) * 0.038), height: d * (0.40 + CGFloat(i) * 0.038))
            }

            Circle()
                .stroke(Color.white.opacity(0.06), lineWidth: max(1, d * 0.006))
                .frame(width: d * 0.985, height: d * 0.985)

            label
                .frame(width: d * 0.36, height: d * 0.36)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.black.opacity(0.35), lineWidth: 1))

            Circle()
                .fill(Color(white: 0.85))
                .frame(width: d * 0.03, height: d * 0.03)
                .overlay(Circle().stroke(Color.black.opacity(0.5), lineWidth: 0.5))
        }
        .frame(width: d, height: d)
        .drawingGroup()
    }

    @ViewBuilder
    private var label: some View {
        if let artwork {
            Image(nsImage: artwork)
                .resizable()
                .interpolation(.high)
                .scaledToFill()
        } else {
            ZStack {
                LinearGradient(colors: [Color(red: 0.93, green: 0.36, blue: 0.24),
                                        Color(red: 0.72, green: 0.13, blue: 0.24)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                Image(systemName: "music.note")
                    .font(.system(size: diameter * 0.09, weight: .bold))
                    .foregroundColor(.white.opacity(0.9))
            }
        }
    }
}

/// Reflexo fixo de luz: não gira, então dá a sensação de vinil de verdade.
struct DiscSheen: View {
    var body: some View {
        Circle()
            .fill(AngularGradient(gradient: Gradient(stops: [
                .init(color: Color.white.opacity(0.0), location: 0.00),
                .init(color: Color.white.opacity(0.11), location: 0.10),
                .init(color: Color.white.opacity(0.0), location: 0.22),
                .init(color: Color.white.opacity(0.0), location: 0.50),
                .init(color: Color.white.opacity(0.08), location: 0.60),
                .init(color: Color.white.opacity(0.0), location: 0.72),
                .init(color: Color.white.opacity(0.0), location: 1.00)
            ]), center: .center, angle: .degrees(-20)))
            .blendMode(.screen)
    }
}

/// Braço da agulha. Desenhado apontando para baixo a partir do pivô
/// e girado no sentido horário em direção ao disco.
struct Tonearm: View {
    let diameter: CGFloat
    let angle: Double

    // Ângulos calculados para pivô em (1.04d, 0.10d) e braço de 0.82d:
    // 4° = fora do disco, 18.5° = borda externa, 33° = perto do selo.
    static let restAngle: Double = 4
    static let startAngle: Double = 18.5
    static let endAngle: Double = 33

    var body: some View {
        let d = diameter
        let width = d * 1.16
        let height = d
        let px = d * 1.04
        let py = d * 0.10
        let length = d * 0.82
        let metal = LinearGradient(colors: [Color(white: 0.92), Color(white: 0.62), Color(white: 0.85)],
                                   startPoint: .leading, endPoint: .trailing)

        ZStack {
            Circle()
                .fill(LinearGradient(colors: [Color(white: 0.75), Color(white: 0.45)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: d * 0.15, height: d * 0.15)
                .shadow(color: .black.opacity(0.4), radius: d * 0.02, x: 0, y: d * 0.01)
                .position(x: px, y: py)

            ZStack {
                RoundedRectangle(cornerRadius: d * 0.015, style: .continuous)
                    .fill(Color(white: 0.3))
                    .frame(width: d * 0.075, height: d * 0.085)
                    .position(x: px, y: py - d * 0.055)

                Capsule()
                    .fill(metal)
                    .frame(width: d * 0.022, height: length)
                    .position(x: px, y: py + length / 2)

                RoundedRectangle(cornerRadius: d * 0.012, style: .continuous)
                    .fill(Color(white: 0.16))
                    .overlay(
                        RoundedRectangle(cornerRadius: d * 0.012, style: .continuous)
                            .stroke(Color.white.opacity(0.25), lineWidth: 0.5)
                    )
                    .frame(width: d * 0.055, height: d * 0.095)
                    .position(x: px, y: py + length - d * 0.02)
            }
            .shadow(color: .black.opacity(0.45), radius: d * 0.015, x: d * 0.01, y: d * 0.02)
            .rotationEffect(.degrees(angle), anchor: UnitPoint(x: px / width, y: py / height))

            Circle()
                .fill(Color(white: 0.88))
                .frame(width: d * 0.05, height: d * 0.05)
                .position(x: px, y: py)
        }
        .frame(width: width, height: height)
        .animation(.easeInOut(duration: 0.9), value: angle)
        .allowsHitTesting(false)
    }
}

// MARK: - Volume

/// Barra de volume vertical: arraste para ajustar, clique no alto-falante para silenciar.
struct VolumeSlider: View {
    @ObservedObject var player: PlayerModel
    let height: CGFloat

    static let width: CGFloat = 18

    var body: some View {
        VStack(spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .bottom) {
                    Capsule().fill(Color.white.opacity(0.22))
                    Capsule().fill(Color.white)
                        .frame(height: max(4, geo.size.height * CGFloat(player.volume / 100)))
                }
                .frame(width: 4)
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let fraction = 1 - min(max(value.location.y / max(geo.size.height, 1), 0), 1)
                            player.setVolume(Double(fraction) * 100)
                        }
                )
            }

            Button {
                player.toggleMute()
            } label: {
                Image(systemName: Self.icon(for: player.volume))
                    .font(.system(size: 10, weight: .semibold))
                    .frame(width: Self.width, height: 14)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .opacity(0.8)
        }
        .frame(width: Self.width, height: height)
        .foregroundColor(.white)
        .help("Volume \(Int(player.volume))% — arraste, ou role o mouse sobre a vitrola")
    }

    static func icon(for volume: Double) -> String {
        if volume <= 0 { return "speaker.slash.fill" }
        if volume < 34 { return "speaker.wave.1.fill" }
        if volume < 67 { return "speaker.wave.2.fill" }
        return "speaker.wave.3.fill"
    }
}

/// Aviso rápido de volume sobre o disco enquanto se rola o mouse.
struct VolumeHUD: View {
    let volume: Double
    let diameter: CGFloat

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: VolumeSlider.icon(for: volume))
            Text("\(Int(volume.rounded()))%")
                .monospacedDigit()
        }
        .font(.system(size: max(11, diameter * 0.065), weight: .bold))
        .foregroundColor(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Capsule().fill(Color.black.opacity(0.7)))
    }
}

/// Vitrola + barra de volume que só aparece com o mouse em cima (ou enquanto se rola o volume).
struct TurntableWithVolume: View {
    @ObservedObject var player: PlayerModel
    let diameter: CGFloat
    let showArm: Bool
    let sliderHeight: CGFloat
    let spacing: CGFloat

    @State private var hovering = false

    private var showSlider: Bool { hovering || player.showVolumeHUD }

    var body: some View {
        HStack(alignment: .center, spacing: spacing) {
            TurntableView(player: player, diameter: diameter, showArm: showArm)
            VolumeSlider(player: player, height: sliderHeight)
                .opacity(showSlider ? 1 : 0)
                .allowsHitTesting(showSlider)
        }
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
        .animation(.easeInOut(duration: 0.2), value: showSlider)
    }
}
