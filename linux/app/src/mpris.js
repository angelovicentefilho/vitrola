// A Vitrola como player MPRIS (org.mpris.MediaPlayer2.vitrola): o controle de mídia do GNOME,
// as teclas de mídia e apps como o playerctl passam a ver e controlar a música.
// Especificação: https://specifications.freedesktop.org/mpris-spec/latest/

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {log} from './log.js';
import * as M from './mpris-map.js';

const BUS_NAME = 'org.mpris.MediaPlayer2.vitrola';
const OBJECT_PATH = '/org/mpris/MediaPlayer2';

const ROOT_XML = `
<node>
  <interface name="org.mpris.MediaPlayer2">
    <method name="Raise"/>
    <method name="Quit"/>
    <property name="CanQuit" type="b" access="read"/>
    <property name="CanRaise" type="b" access="read"/>
    <property name="HasTrackList" type="b" access="read"/>
    <property name="Identity" type="s" access="read"/>
    <property name="DesktopEntry" type="s" access="read"/>
    <property name="SupportedUriSchemes" type="as" access="read"/>
    <property name="SupportedMimeTypes" type="as" access="read"/>
  </interface>
</node>`;

const PLAYER_XML = `
<node>
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="Next"/>
    <method name="Previous"/>
    <method name="Pause"/>
    <method name="PlayPause"/>
    <method name="Stop"/>
    <method name="Play"/>
    <method name="Seek"><arg direction="in" name="Offset" type="x"/></method>
    <method name="SetPosition">
      <arg direction="in" name="TrackId" type="o"/>
      <arg direction="in" name="Position" type="x"/>
    </method>
    <method name="OpenUri"><arg direction="in" name="Uri" type="s"/></method>
    <signal name="Seeked"><arg name="Position" type="x"/></signal>
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="Rate" type="d" access="readwrite"/>
    <property name="Metadata" type="a{sv}" access="read"/>
    <property name="Volume" type="d" access="readwrite"/>
    <property name="Position" type="x" access="read"/>
    <property name="MinimumRate" type="d" access="read"/>
    <property name="MaximumRate" type="d" access="read"/>
    <property name="CanGoNext" type="b" access="read"/>
    <property name="CanGoPrevious" type="b" access="read"/>
    <property name="CanPlay" type="b" access="read"/>
    <property name="CanPause" type="b" access="read"/>
    <property name="CanSeek" type="b" access="read"/>
    <property name="CanControl" type="b" access="read"/>
  </interface>
</node>`;

function packMetadata(meta) {
    const packed = {};
    for (const [key, [signature, value]] of Object.entries(meta))
        packed[key] = new GLib.Variant(signature, value);
    return packed;
}

/** Interface raiz: identidade do player, trazer para frente e sair. */
class Root {
    constructor({desktopEntry, onRaise, onQuit}) {
        this._desktopEntry = desktopEntry;
        this._onRaise = onRaise;
        this._onQuit = onQuit;
    }

    Raise() {
        this._onRaise();
    }

    Quit() {
        this._onQuit();
    }

    get CanQuit() {
        return true;
    }

    get CanRaise() {
        return true;
    }

    get HasTrackList() {
        return false;
    }

    get Identity() {
        return 'Vitrola';
    }

    get DesktopEntry() {
        return this._desktopEntry;
    }

    get SupportedUriSchemes() {
        return [];
    }

    get SupportedMimeTypes() {
        return [];
    }
}

/** Interface Player: estado, metadados e comandos, ligados ao PlayerModel. */
class Player {
    constructor(model, images) {
        this._model = model;
        this._images = images;
        this._artPath = null;
        this._artURL = null;
    }

    get _track() {
        return this._model.track;
    }

    Next() {
        this._model.next();
    }

    Previous() {
        this._model.previous();
    }

    Pause() {
        if (this._model.isPlaying)
            this._model.playPause();
    }

    Play() {
        if (this._track && !this._model.isPlaying)
            this._model.playPause();
    }

    PlayPause() {
        this._model.playPause();
    }

    /** O YouTube Music não tem "parar": pausa. */
    Stop() {
        this.Pause();
    }

    Seek(offset) {
        if (!this._track)
            return;
        const target = this._model.position() + offset / 1e6;
        if (this._track.duration > 0 && target > this._track.duration)
            this._model.next();
        else
            this._model.seek(Math.max(0, target));
    }

    SetPosition(trackId, position) {
        const track = this._track;
        if (!track || trackId !== M.trackId(track))
            return;
        const seconds = position / 1e6;
        if (seconds < 0 || (track.duration > 0 && seconds > track.duration))
            return;
        this._model.seek(seconds);
    }

    /** Sem esquemas suportados: abrir URIs não faz parte da Vitrola. */
    OpenUri(_uri) {}

    get PlaybackStatus() {
        return M.playbackStatus(this._track);
    }

    get Rate() {
        return 1.0;
    }

    set Rate(_value) {}

    get Metadata() {
        return packMetadata(M.metadata(this._track, this._artPath));
    }

    get Volume() {
        return M.volumeToMpris(this._model.volume);
    }

    set Volume(value) {
        this._model.setVolume(M.volumeFromMpris(value));
    }

    get Position() {
        return M.toMicros(this._model.position());
    }

    get MinimumRate() {
        return 1.0;
    }

    get MaximumRate() {
        return 1.0;
    }

    get CanGoNext() {
        return this._track !== null;
    }

    get CanGoPrevious() {
        return this._track !== null;
    }

    get CanPlay() {
        return this._track !== null;
    }

    get CanPause() {
        return this._track !== null;
    }

    get CanSeek() {
        return this._track !== null && this._track.duration > 0;
    }

    get CanControl() {
        return true;
    }

    /** Baixa a capa quando a faixa muda; avisa de novo quando o arquivo estiver pronto. */
    updateArt(onReady) {
        const url = this._track?.artworkURL ?? null;
        if (url === this._artURL)
            return;
        this._artURL = url;
        this._artPath = null;
        if (!url)
            return;
        this._images.fetch(url).then(path => {
            if (url !== this._artURL || !path)
                return;
            this._artPath = path;
            onReady();
        });
    }
}

const PLAYER_PROPERTIES = ['PlaybackStatus', 'Metadata', 'Volume', 'CanGoNext', 'CanGoPrevious',
    'CanPlay', 'CanPause', 'CanSeek'];

/** Publica a Vitrola no barramento de sessão enquanto o app estiver rodando. */
export class MprisService {
    constructor({connection, model, images, desktopEntry, onRaise, onQuit}) {
        this._model = model;
        this._root = Gio.DBusExportedObject.wrapJSObject(ROOT_XML, new Root({desktopEntry, onRaise, onQuit}));
        this._playerImpl = new Player(model, images);
        this._player = Gio.DBusExportedObject.wrapJSObject(PLAYER_XML, this._playerImpl);
        this._root.export(connection, OBJECT_PATH);
        this._player.export(connection, OBJECT_PATH);

        this._seeks = new M.SeekDetector();
        this._lastValues = {};
        this._modelHandler = model.connect(() => this._sync());

        this._nameId = Gio.bus_own_name_on_connection(connection, BUS_NAME, Gio.BusNameOwnerFlags.NONE,
            () => log(`MPRIS publicado como ${BUS_NAME}`),
            () => log(`não consegui o nome ${BUS_NAME} no D-Bus`));
        this._sync();
    }

    /** Avisa (PropertiesChanged) só o que mudou, e emite Seeked em saltos de posição. */
    _sync() {
        this._playerImpl.updateArt(() => this._sync());
        for (const name of PLAYER_PROPERTIES) {
            const value = this._playerImpl[name];
            const key = name === 'Metadata' ? JSON.stringify(M.metadata(this._model.track, this._playerImpl._artPath)) : JSON.stringify(value);
            if (this._lastValues[name] === key)
                continue;
            this._lastValues[name] = key;
            const signature = this._signatureOf(name);
            this._player.emit_property_changed(name, new GLib.Variant(signature, value));
        }
        const jump = this._seeks.update(this._model.track, this._model.position(), Date.now());
        if (jump !== null)
            this._player.emit_signal('Seeked', new GLib.Variant('(x)', [M.toMicros(jump)]));
    }

    _signatureOf(name) {
        switch (name) {
        case 'PlaybackStatus':
            return 's';
        case 'Metadata':
            return 'a{sv}';
        case 'Volume':
            return 'd';
        default:
            return 'b';
        }
    }

    destroy() {
        this._model.disconnect(this._modelHandler);
        Gio.bus_unown_name(this._nameId);
        this._player.unexport();
        this._root.unexport();
    }
}
