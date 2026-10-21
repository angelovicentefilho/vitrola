import AppKit
import Combine

enum WindowPlacement: String, CaseIterable {
    case front, normal, desktop

    var title: String {
        switch self {
        case .front: return "Sempre na frente"
        case .normal: return "Janela normal"
        case .desktop: return "Na mesa (atrás das janelas)"
        }
    }
}

enum PlayerSize: String, CaseIterable {
    case small, medium, large

    var title: String {
        switch self {
        case .small: return "Pequeno"
        case .medium: return "Médio"
        case .large: return "Grande"
        }
    }

    var discDiameter: CGFloat {
        switch self {
        case .small: return 150
        case .medium: return 210
        case .large: return 280
        }
    }
}

enum PlayerLayout: String, CaseIterable {
    case disc, card

    var title: String {
        switch self {
        case .disc: return "Só o disco"
        case .card: return "Cartão com informações"
        }
    }
}

enum BrowserChoice: String, CaseIterable {
    case auto, chrome, safari, brave, edge, arc

    var title: String {
        switch self {
        case .auto: return "Automático"
        case .chrome: return "Google Chrome"
        case .safari: return "Safari"
        case .brave: return "Brave"
        case .edge: return "Microsoft Edge"
        case .arc: return "Arc"
        }
    }

    var targets: [BrowserTarget] {
        switch self {
        case .auto: return BrowserTarget.all
        case .chrome: return [.chrome]
        case .safari: return [.safari]
        case .brave: return [.brave]
        case .edge: return [.edge]
        case .arc: return [.arc]
        }
    }
}

/// Preferências do usuário, persistidas em UserDefaults.
@MainActor
final class Settings: ObservableObject {
    static let shared = Settings()

    private let defaults = UserDefaults.standard

    @Published var placement: WindowPlacement { didSet { defaults.set(placement.rawValue, forKey: "placement") } }
    @Published var size: PlayerSize { didSet { defaults.set(size.rawValue, forKey: "size") } }
    @Published var layout: PlayerLayout { didSet { defaults.set(layout.rawValue, forKey: "layout") } }
    @Published var browser: BrowserChoice { didSet { defaults.set(browser.rawValue, forKey: "browser") } }
    @Published var showTonearm: Bool { didSet { defaults.set(showTonearm, forKey: "showTonearm") } }
    @Published var albumColorBackground: Bool { didSet { defaults.set(albumColorBackground, forKey: "albumColorBackground") } }
    @Published var showProgress: Bool { didSet { defaults.set(showProgress, forKey: "showProgress") } }
    @Published var showNotch: Bool { didSet { defaults.set(showNotch, forKey: "showNotch") } }
    @Published var showFloating: Bool { didSet { defaults.set(showFloating, forKey: "showFloating") } }
    @Published var showPlaylist: Bool { didSet { defaults.set(showPlaylist, forKey: "showPlaylist") } }

    private init() {
        placement = WindowPlacement(rawValue: defaults.string(forKey: "placement") ?? "") ?? .front
        size = PlayerSize(rawValue: defaults.string(forKey: "size") ?? "") ?? .medium
        layout = PlayerLayout(rawValue: defaults.string(forKey: "layout") ?? "") ?? .card
        browser = BrowserChoice(rawValue: defaults.string(forKey: "browser") ?? "") ?? .auto
        showTonearm = defaults.object(forKey: "showTonearm") as? Bool ?? true
        albumColorBackground = defaults.object(forKey: "albumColorBackground") as? Bool ?? true
        showProgress = defaults.object(forKey: "showProgress") as? Bool ?? true
        showNotch = defaults.object(forKey: "showNotch") as? Bool ?? true
        showFloating = defaults.object(forKey: "showFloating") as? Bool ?? false
        showPlaylist = defaults.object(forKey: "showPlaylist") as? Bool ?? false
    }
}
