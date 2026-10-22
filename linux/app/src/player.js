// YouTube Music rodando dentro da própria Vitrola, sem navegador.
// O login fica salvo numa sessão só da Vitrola (~/.local/share/vitrola/webkit).
//
// O resto do app só conversa com o player por esta interface:
//   carregar(), executarJS(js), mostrar(), esconder() e o callback onEstado.
// Se o WebKitGTK não servir (ver design.md, D3), troca-se só este módulo.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import WebKit from 'gi://WebKit?version=6.0';

import {log} from './log.js';

export const HOME = 'https://music.youtube.com';

/// Identifica-se como Safari: o Google bloqueia login em navegadores "desconhecidos".
/// Mesmo valor do app do Mac; VITROLA_USER_AGENT troca para testes.
const SAFARI_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';

function userAgent() {
    return GLib.getenv('VITROLA_USER_AGENT') || SAFARI_USER_AGENT;
}

function hostOf(uri) {
    try {
        return GLib.Uri.parse(uri, GLib.UriFlags.NONE).get_host() ?? '';
    } catch {
        return '';
    }
}

function isOwnSite(uri) {
    const host = hostOf(uri);
    return ['youtube.com', 'google.com'].some(d => host === d || host.endsWith(`.${d}`));
}

/** Sessão de rede própria, com cookies persistentes em SQLite. */
function createSession() {
    const dataDir = GLib.build_filenamev([GLib.get_user_data_dir(), 'vitrola', 'webkit']);
    const cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'vitrola', 'webkit']);
    GLib.mkdir_with_parents(dataDir, 0o700);
    const session = WebKit.NetworkSession.new(dataDir, cacheDir);
    session.get_cookie_manager().set_persistent_storage(
        GLib.build_filenamev([dataDir, 'cookies.sqlite']),
        WebKit.CookiePersistentStorage.SQLITE);
    log(`dados do site em ${dataDir}`);
    return session;
}

export class WebPlayer {
    constructor(application) {
        this._app = application;
        this._view = null;
        this._window = null;
        this._loadedOnce = false;
    }

    get janelaVisivel() {
        return this._window?.visible ?? false;
    }

    /** Cria a web view e carrega o YouTube Music (uma vez só). */
    carregar() {
        if (this._view)
            return;

        const view = new WebKit.WebView({network_session: createSession()});
        const settings = view.get_settings();
        settings.set_user_agent(userAgent());
        settings.set_media_playback_requires_user_gesture(false);
        settings.set_javascript_can_open_windows_automatically(true);
        settings.set_enable_developer_extras(Boolean(GLib.getenv('VITROLA_DEBUG')));

        view.connect('load-changed', (v, event) => {
            if (event !== WebKit.LoadEvent.FINISHED) {
                log(`carregando (${event}) ${v.get_uri()}`);
                return;
            }
            this._loadedOnce = true;
            log(`carregou ${v.get_uri()}`);
        });
        view.connect('load-failed', (_v, _event, uri, error) => {
            log(`falhou ao carregar ${uri}: ${error.message}`);
            return false;
        });
        // Links que abririam outra janela (ex.: login): google/youtube na mesma, o resto no navegador.
        // Só http(s) sai para o navegador: outros esquemas (file:, apt: …) abririam apps locais.
        view.connect('create', (v, action) => {
            const uri = action.get_request().get_uri();
            if (isOwnSite(uri))
                v.load_uri(uri);
            else if (/^https?:\/\//i.test(uri))
                Gio.AppInfo.launch_default_for_uri_async(uri, null, null, null);
            else
                log(`ignorou link para ${uri}`);
            return null;
        });

        const window = new Gtk.ApplicationWindow({
            application: this._app,
            title: 'YouTube Music — Vitrola',
            default_width: 1100,
            default_height: 760,
            child: view,
        });
        window.set_size_request(520, 420);

        this._view = view;
        this._window = window;
        log('janela criada');
        view.load_uri(HOME);
    }

    mostrar() {
        this.carregar();
        this._window.present();
    }

    esconder() {
        this._window?.set_visible(false);
    }

    /**
     * Executa JS na página do YouTube Music e devolve o resultado como texto.
     * Fora do YouTube Music (ex.: na tela de login) devolve '' sem executar.
     */
    executarJS(js) {
        this.carregar();
        if (!this._loadedOnce)
            return Promise.reject(new Error('carregando'));
        if (hostOf(this._view.get_uri() ?? '') !== 'music.youtube.com')
            return Promise.resolve('');
        return new Promise((resolve, reject) => {
            this._view.evaluate_javascript(js, -1, null, null, null, (view, result) => {
                try {
                    resolve(view.evaluate_javascript_finish(result).to_string());
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
