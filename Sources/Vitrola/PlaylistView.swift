import SwiftUI
import AppKit

/// Janela "A seguir": a fila do YouTube Music no estilo da Vitrola.
struct PlaylistView: View {
    @ObservedObject var queue: QueueModel
    @ObservedObject var player: PlayerModel
    @ObservedObject var settings = Settings.shared
    let box: WindowBox

    static let size = CGSize(width: 340, height: 460)
    static let pad: CGFloat = 14

    var body: some View {
        VStack(spacing: 0) {
            header
                .modifier(WindowDragger(box: box))
            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 1)
            content
        }
        .frame(width: Self.size.width, height: Self.size.height)
        .foregroundColor(.white)
        .background(CardBackground(player: player, useAlbumColor: settings.albumColorBackground))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.35), radius: 10, x: 0, y: 6)
        .padding(Self.pad)
    }

    // MARK: - Cabeçalho

    private var header: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("A seguir")
                    .font(.system(size: 15, weight: .bold))
                Text(summary)
                    .font(.system(size: 11))
                    .opacity(0.6)
            }
            Spacer()
            headerButton("arrow.clockwise", help: "Atualizar a fila") { queue.refresh() }
            headerButton("xmark", help: "Fechar a playlist") { settings.showPlaylist = false }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private var summary: String {
        let count = queue.items.count
        guard count > 0 else { return "YouTube Music" }
        let label = count == 1 ? "1 faixa" : "\(count) faixas"
        let total = queue.totalSeconds
        guard total > 0 else { return label }
        let h = total / 3600, m = (total % 3600) / 60
        return h > 0 ? "\(label) · \(h) h \(m) min" : "\(label) · \(m) min"
    }

    private func headerButton(_ symbol: String, help: String, action: @escaping @MainActor () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 12, weight: .bold))
                .frame(width: 26, height: 26)
                .background(Circle().fill(Color.white.opacity(0.12)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help(help)
    }

    // MARK: - Lista

    @ViewBuilder
    private var content: some View {
        if !queue.loaded {
            placeholder {
                ProgressView().controlSize(.small)
                Text("Lendo a fila…")
            }
        } else if queue.items.isEmpty {
            placeholder {
                Image(systemName: "music.note.list")
                    .font(.system(size: 28, weight: .semibold))
                    .opacity(0.6)
                Text(emptyMessage)
                    .multilineTextAlignment(.center)
                if player.status.needsHelp {
                    Button("Como resolver") { Help.showSetup() }
                        .buttonStyle(.plain)
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.white.opacity(0.2)))
                }
            }
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(queue.items) { item in
                            QueueRow(item: item, playing: player.isPlaying) {
                                queue.play(item)
                            }
                            .id(item.id)
                        }
                    }
                    .padding(8)
                }
                .onAppear { scrollToCurrent(proxy, animated: false) }
                .onChange(of: queue.current?.id) { _ in scrollToCurrent(proxy, animated: true) }
            }
        }
    }

    private var emptyMessage: String {
        if let error = queue.error {
            return PlayerStatus.error(error).message ?? "Não foi possível ler a fila"
        }
        return "A fila está vazia.\nToque um álbum, playlist ou rádio no YouTube Music."
    }

    private func scrollToCurrent(_ proxy: ScrollViewProxy, animated: Bool) {
        guard let id = queue.current?.id else { return }
        if animated {
            withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo(id, anchor: .center) }
        } else {
            proxy.scrollTo(id, anchor: .center)
        }
    }

    private func placeholder<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(spacing: 10) {
            content()
        }
        .font(.system(size: 12))
        .opacity(0.85)
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct QueueRow: View {
    let item: QueueItem
    let playing: Bool
    let action: @MainActor () -> Void

    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                ZStack {
                    QueueThumbnail(url: item.thumbnailURL)
                    if item.isCurrent {
                        Color.black.opacity(0.45)
                        Equalizer(playing: playing, barCount: 3, height: 14)
                            .frame(width: 16, height: 14)
                    }
                }
                .frame(width: 38, height: 38)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 13, weight: item.isCurrent ? .bold : .medium))
                        .lineLimit(1)
                    Text(item.artist)
                        .font(.system(size: 11))
                        .opacity(0.65)
                        .lineLimit(1)
                }

                Spacer(minLength: 6)

                Text(item.duration)
                    .font(.system(size: 11, weight: .medium).monospacedDigit())
                    .opacity(0.6)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.white.opacity(item.isCurrent ? 0.16 : (hovering ? 0.08 : 0)))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .help(item.isCurrent ? "Tocando agora" : "Tocar “\(item.title)”")
    }
}

struct QueueThumbnail: View {
    let url: URL?

    var body: some View {
        if let url {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    fallback
                }
            }
        } else {
            fallback
        }
    }

    private var fallback: some View {
        ZStack {
            Color.white.opacity(0.1)
            Image(systemName: "music.note")
                .font(.system(size: 14, weight: .semibold))
                .opacity(0.5)
        }
    }
}
