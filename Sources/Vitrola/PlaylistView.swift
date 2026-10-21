import SwiftUI
import AppKit

/// Janela da playlist: aba "A seguir" (fila) e aba "Buscar" (busca no YouTube Music).
struct PlaylistView: View {
    @ObservedObject var queue: QueueModel
    @ObservedObject var search: SearchModel
    @ObservedObject var player: PlayerModel
    @ObservedObject var settings = Settings.shared
    @ObservedObject var ui = UIState.shared
    let box: WindowBox

    static let size = CGSize(width: 340, height: 480)
    static let pad: CGFloat = 14

    var body: some View {
        VStack(spacing: 0) {
            header
                .modifier(WindowDragger(box: box))
            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 1)
            switch ui.playlistTab {
            case .queue: queueContent
            case .search: SearchTab(search: search, player: player)
            }
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
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                tabPicker
                Spacer()
                if ui.playlistTab == .queue {
                    headerButton("arrow.clockwise", help: "Atualizar a fila") { queue.refresh() }
                }
                headerButton("xmark", help: "Fechar") { settings.showPlaylist = false }
            }
            if ui.playlistTab == .queue {
                Text(summary)
                    .font(.system(size: 11))
                    .opacity(0.6)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private var tabPicker: some View {
        HStack(spacing: 2) {
            ForEach(PlaylistTab.allCases, id: \.self) { tab in
                Button {
                    ui.playlistTab = tab
                    if tab == .search { ui.focusSearch += 1 }
                } label: {
                    Text(tab.title)
                        .font(.system(size: 12, weight: .semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(
                            Capsule().fill(Color.white.opacity(ui.playlistTab == tab ? 0.22 : 0))
                        )
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .opacity(ui.playlistTab == tab ? 1 : 0.65)
            }
        }
        .padding(2)
        .background(Capsule().fill(Color.white.opacity(0.08)))
    }

    private var summary: String {
        let count = queue.items.count
        guard count > 0 else { return "Fila do YouTube Music" }
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

    // MARK: - A seguir

    @ViewBuilder
    private var queueContent: some View {
        if !queue.loaded {
            PlaylistPlaceholder {
                ProgressView().controlSize(.small)
                Text("Lendo a fila…")
            }
        } else if queue.items.isEmpty {
            PlaylistPlaceholder {
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
                            TrackRow(title: item.title, subtitle: item.artist, trailing: item.duration,
                                     thumbnailURL: item.thumbnailURL, isCurrent: item.isCurrent,
                                     playing: player.isPlaying) {
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
        return "A fila está vazia.\nBusque uma música na aba Buscar, ou toque um álbum no YouTube Music."
    }

    private func scrollToCurrent(_ proxy: ScrollViewProxy, animated: Bool) {
        guard let id = queue.current?.id else { return }
        if animated {
            withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo(id, anchor: .center) }
        } else {
            proxy.scrollTo(id, anchor: .center)
        }
    }
}

// MARK: - Buscar

struct SearchTab: View {
    @ObservedObject var search: SearchModel
    @ObservedObject var player: PlayerModel
    @ObservedObject var ui = UIState.shared
    @FocusState private var fieldFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12, weight: .semibold))
                    .opacity(0.7)
                TextField("Música, artista ou álbum", text: $search.query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                    .focused($fieldFocused)
                    .onSubmit { search.search() }
                if !search.query.isEmpty {
                    Button {
                        search.query = ""
                        fieldFocused = true
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .opacity(0.6)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.white.opacity(0.12)))
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 4)

            results
        }
        .onAppear { focusSoon() }
        .onChange(of: ui.focusSearch) { _ in focusSoon() }
    }

    @ViewBuilder
    private var results: some View {
        switch search.phase {
        case .idle:
            PlaylistPlaceholder {
                Image(systemName: "music.magnifyingglass")
                    .font(.system(size: 28, weight: .semibold))
                    .opacity(0.6)
                Text("Digite e aperte Enter para buscar no YouTube Music.")
                    .multilineTextAlignment(.center)
            }
        case .searching:
            PlaylistPlaceholder {
                ProgressView().controlSize(.small)
                Text("Buscando…")
            }
        case .failed(let message):
            PlaylistPlaceholder {
                Image(systemName: "exclamationmark.magnifyingglass")
                    .font(.system(size: 26, weight: .semibold))
                    .opacity(0.6)
                Text(message)
                    .multilineTextAlignment(.center)
            }
        case .done:
            ScrollView {
                LazyVStack(spacing: 2) {
                    ForEach(search.results) { result in
                        TrackRow(title: result.title, subtitle: result.subtitle, trailing: "",
                                 thumbnailURL: result.thumbnailURL,
                                 isCurrent: result.title == player.track?.title,
                                 playing: player.isPlaying) {
                            search.play(result)
                        }
                    }
                }
                .padding(8)
            }
        }
    }

    /// O foco precisa esperar a janela aparecer.
    private func focusSoon() {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 150_000_000)
            fieldFocused = true
        }
    }
}

// MARK: - Peças compartilhadas

struct PlaylistPlaceholder<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 10) {
            content()
        }
        .font(.system(size: 12))
        .opacity(0.85)
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Linha de faixa usada na fila e nos resultados da busca.
struct TrackRow: View {
    let title: String
    let subtitle: String
    let trailing: String
    let thumbnailURL: URL?
    let isCurrent: Bool
    let playing: Bool
    let action: @MainActor () -> Void

    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                ZStack {
                    QueueThumbnail(url: thumbnailURL)
                    if isCurrent {
                        Color.black.opacity(0.45)
                        Equalizer(playing: playing, barCount: 3, height: 14)
                            .frame(width: 16, height: 14)
                    } else if hovering {
                        Color.black.opacity(0.4)
                        Image(systemName: "play.fill")
                            .font(.system(size: 13, weight: .bold))
                    }
                }
                .frame(width: 38, height: 38)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13, weight: isCurrent ? .bold : .medium))
                        .lineLimit(1)
                    if !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 11))
                            .opacity(0.65)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 6)

                if !trailing.isEmpty {
                    Text(trailing)
                        .font(.system(size: 11, weight: .medium).monospacedDigit())
                        .opacity(0.6)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.white.opacity(isCurrent ? 0.16 : (hovering ? 0.08 : 0)))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .help(isCurrent ? "Tocando agora" : "Tocar “\(title)”")
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
