// O app Vitrola: junta o player, o estado, as preferências, o menu e as integrações (MPRIS,
// interface privada para a extensão, saída de áudio, autostart) e executa os itens do menu.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {AudioOutput} from './audio-output.js';
import * as Autostart from './autostart.js';
import {parseCommand} from './commands.js';
import {APP_ID} from './desktop-entry.js';
import {alert, showAbout, showHelp} from './dialogs.js';
import {ImageCache} from './images.js';
import {FloatingVinyl} from './floating.js';
import {log} from './log.js';
import {buildMenu, parseItemId} from './menu.js';
import {menuButton} from './menu-view.js';
import {PlayerModel} from './model.js';
import {MprisService} from './mpris.js';
import {WebPlayer} from './player.js';
import {PrefsStore} from './prefs-store.js';
import {VitrolaService} from './service.js';

/** Nome que a extensão do GNOME Shell publica no D-Bus enquanto está ativa. */
export const EXTENSION_BUS_NAME = 'io.github.vitrola.Shell';

export class Vitrola {
    constructor(application) {
        this.app = application;
        this.extensionActive = false;
        this.floating = null;     // vitrola flutuante (floating.js)
        this.playlist = null;     // janela da playlist e busca (playlist.js)
        this._artURL = null;
        this._artPath = null;
        this._quitting = false;
    }

    startup() {
        this.prefs = new PrefsStore();
        this.player = new WebPlayer(this.app);
        this.player.carregar();
        this.model = new PlayerModel(js => this.player.executarJS(js));
        this.audio = new AudioOutput();
        this.images = new ImageCache();
        this.images.prune();

        const connection = this.app.get_dbus_connection();
        this.mpris = new MprisService({
            connection,
            model: this.model,
            images: this.images,
            desktopEntry: APP_ID,
            onRaise: () => this.player.mostrar(),
            onQuit: () => this.quit(),
        });
        this.service = new VitrolaService(connection, this);
        this._extensionWatch = Gio.bus_watch_name_on_connection(connection, EXTENSION_BUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            () => this._setExtensionActive(true),
            () => this._setExtensionActive(false));

        this.player.addHeaderWidget(menuButton(this));
        this.model.connect(() => this._onModelChanged());
        this.prefs.connect(key => this._onPrefChanged(key));
        this.model.start();
        this.floating = new FloatingVinyl(this);

        const quit = new Gio.SimpleAction({name: 'quit'});
        quit.connect('activate', () => this.quit());
        this.app.add_action(quit);
        this.app.set_accels_for_action('app.quit', ['<Control>q']);
    }

    // MARK: - Estado para a extensão e o menu

    stateJSON() {
        const {model} = this;
        const track = model.track ? {...model.track, artPath: this._artPath} : null;
        return JSON.stringify({
            status: model.status,
            message: model.message,
            track,
            position: model.position(),
            positionAt: Date.now(),
            volume: model.volume,
            volumeChangedAt: model.volumeChangedAt,
        });
    }

    prefsJSON() {
        return JSON.stringify(this.prefs.values);
    }

    menu() {
        return buildMenu({
            player: {track: this.model.track, message: this.model.message, volume: this.model.volume},
            prefs: this.prefs.values,
            audio: {devices: this.audio.devices, current: this.audio.current},
            extensionActive: this.extensionActive,
            autostart: Autostart.isEnabled(),
        });
    }

    /** O menu com as saídas de áudio relidas. */
    async refreshMenu() {
        await this.audio.refresh();
        return this.menu();
    }

    async menuJSON() {
        return JSON.stringify(await this.refreshMenu());
    }

    // MARK: - Ações

    /** Executa um item do menu pelo id (do popover do app ou da extensão). */
    activate(id) {
        const parsed = parseItemId(id);
        if (!parsed) {
            log(`item de menu desconhecido: ${id}`);
            return;
        }
        log(`menu: ${id}`);
        switch (parsed.action) {
        case 'toggle':
            if (parsed.key === 'autostart')
                Autostart.setEnabled(!Autostart.isEnabled());
            else
                this.prefs.toggle(parsed.key);
            break;
        case 'choose':
            this.prefs.set(parsed.key, parsed.value);
            break;
        case 'audio':
            this.audio.select(parsed.value).catch(e => {
                log(`saída de áudio recusada: ${e.message}`);
                alert(this._dialogParent(), 'Não foi possível trocar a saída de áudio',
                    'Tente pelas Configurações Rápidas do GNOME (canto superior direito).');
            });
            break;
        case 'playPause':
            this.model.playPause();
            break;
        case 'next':
            this.model.next();
            break;
        case 'previous':
            this.model.previous();
            break;
        case 'like':
            this.model.toggleLike();
            break;
        case 'search':
            this.showSearch();
            break;
        case 'openYouTube':
            this.player.mostrar();
            break;
        case 'help':
            showHelp(this._dialogParent());
            break;
        case 'about':
            showAbout(this._dialogParent());
            break;
        case 'quit':
            this.quit();
            break;
        }
    }

    /** Comando em JSON vindo da extensão ou do D-Bus. Devolve se foi aceito. */
    command(json) {
        const cmd = parseCommand(json);
        if (!cmd) {
            log(`comando recusado: ${json}`);
            return false;
        }
        const {model} = this;
        switch (cmd.name) {
        case 'playPause':
            model.playPause();
            break;
        case 'next':
            model.next();
            break;
        case 'previous':
            model.previous();
            break;
        case 'toggleLike':
            model.toggleLike();
            break;
        case 'toggleMute':
            model.toggleMute();
            break;
        case 'seek':
            model.seek(cmd.seconds);
            break;
        case 'seekFraction':
            if (!model.track?.duration)
                return false;
            model.seek(cmd.fraction * model.track.duration);
            break;
        case 'setVolume':
            model.setVolume(cmd.value);
            break;
        case 'adjustVolume':
            model.adjustVolume(cmd.delta);
            break;
        case 'playQueueItem':
            model.playQueueItem(cmd.index);
            break;
        case 'search':
            model.search(cmd.query);
            break;
        case 'playSearchResult':
            model.playSearchResult(cmd.index, cmd.videoID);
            break;
        case 'showWindow':
            this.player.mostrar();
            break;
        }
        return true;
    }

    showSearch() {
        this.playlist?.show('search');
    }

    showPlaylist() {
        this.playlist?.show('queue');
    }

    /** Para a música e encerra o app. */
    quit() {
        if (this._quitting)
            return;
        this._quitting = true;
        this.model.stop();
        this.mpris.destroy();
        this.service.destroy();
        Gio.bus_unwatch_name(this._extensionWatch);
        this.player.pausar();
        // Dá um instante para o JS de pausa chegar à página antes de fechar.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            this.app.quit();
            return GLib.SOURCE_REMOVE;
        });
    }

    // MARK: - Reações

    _onModelChanged() {
        this._updateArt();
        this.service.emitState(this.stateJSON());
    }

    _onPrefChanged(key) {
        log(`preferência ${key} = ${this.prefs.get(key)}`);
        this.service.emitPrefs(this.prefsJSON());
    }

    _setExtensionActive(active) {
        if (this.extensionActive === active)
            return;
        this.extensionActive = active;
        log(`extensão do GNOME Shell ${active ? 'ativa' : 'inativa'}`);
    }

    /** Baixa a capa da faixa atual; quando estiver pronta, avisa a extensão de novo. */
    _updateArt() {
        const url = this.model.track?.artworkURL ?? null;
        if (url === this._artURL)
            return;
        this._artURL = url;
        this._artPath = null;
        if (!url)
            return;
        this.images.fetch(url).then(path => {
            if (url !== this._artURL || !path)
                return;
            this._artPath = path;
            this.service.emitState(this.stateJSON());
        });
    }

    _dialogParent() {
        return this.player.janelaVisivel ? this.player.window : null;
    }
}
