// Tradução do estado da Vitrola para o padrão MPRIS. Módulo puro (sem GTK/D-Bus):
// devolve valores como [assinatura D-Bus, valor], que o mpris.js empacota em GLib.Variant.

export const NO_TRACK = '/org/mpris/MediaPlayer2/TrackList/NoTrack';
const TRACK_PREFIX = '/io/github/vitrola/Vitrola/faixa/';

/** Hash curto e estável (djb2, 32 bits) para montar o id da faixa. */
function hash(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++)
        h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, '0');
}

/** Caminho D-Bus que identifica a faixa (muda quando título, artista ou álbum mudam). */
export function trackId(track) {
    if (!track)
        return NO_TRACK;
    return TRACK_PREFIX + hash(`${track.title}\u0000${track.artist}\u0000${track.album}`);
}

/** Microssegundos inteiros, como o MPRIS espera. */
export function toMicros(seconds) {
    return Math.max(0, Math.round((Number(seconds) || 0) * 1e6));
}

/**
 * Metadados MPRIS. `artPath` é o arquivo local da capa (ou null enquanto não baixou).
 * @returns {Object<string, [string, *]>}
 */
export function metadata(track, artPath = null) {
    const meta = {'mpris:trackid': ['o', trackId(track)]};
    if (!track)
        return meta;
    meta['xesam:title'] = ['s', track.title];
    if (track.artist)
        meta['xesam:artist'] = ['as', [track.artist]];
    if (track.album)
        meta['xesam:album'] = ['s', track.album];
    if (track.duration > 0)
        meta['mpris:length'] = ['x', toMicros(track.duration)];
    if (artPath)
        meta['mpris:artUrl'] = ['s', fileUri(artPath)];
    return meta;
}

/** file:// de um caminho absoluto, com os caracteres especiais escapados. */
export function fileUri(path) {
    return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function playbackStatus(track) {
    if (!track)
        return 'Stopped';
    return track.isPlaying ? 'Playing' : 'Paused';
}

/** Volume da Vitrola (0–100) ↔ MPRIS (0,0–1,0). */
export const volumeToMpris = v => Math.min(Math.max((Number(v) || 0) / 100, 0), 1);
export const volumeFromMpris = v => Math.min(Math.max(Math.round((Number(v) || 0) * 100), 0), 100);

/**
 * Detecta saltos de posição (busca, arrasto, nova faixa) para o sinal Seeked.
 * Entre duas leituras, a posição esperada é a anterior + o tempo passado (se estava tocando).
 */
export class SeekDetector {
    constructor(toleranceSeconds = 2) {
        this._tolerance = toleranceSeconds;
        this._last = null;
    }

    /** Devolve a nova posição (s) se houve salto, ou null. */
    update(track, position, nowMs) {
        const id = trackId(track);
        const last = this._last;
        this._last = track ? {id, position, playing: track.isPlaying, at: nowMs} : null;
        if (!track || !last)
            return null;
        if (last.id !== id)
            return position;
        const expected = last.position + (last.playing ? (nowMs - last.at) / 1000 : 0);
        return Math.abs(position - expected) > this._tolerance ? position : null;
    }
}
