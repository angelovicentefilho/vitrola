// Comandos que chegam de fora (extensão, D-Bus) em JSON: só passam os conhecidos e bem formados.
// Módulo puro.

const finite = v => typeof v === 'number' && Number.isFinite(v);
const nonNegativeInt = v => Number.isInteger(v) && v >= 0;

const SHAPES = {
    playPause: {},
    next: {},
    previous: {},
    toggleLike: {},
    toggleMute: {},
    showWindow: {},
    seek: {seconds: v => finite(v) && v >= 0},
    seekFraction: {fraction: v => finite(v) && v >= 0 && v <= 1},
    setVolume: {value: v => finite(v) && v >= 0 && v <= 100},
    adjustVolume: {delta: v => finite(v) && Math.abs(v) <= 100},
    playQueueItem: {index: nonNegativeInt},
    search: {query: v => typeof v === 'string' && v.trim().length > 0 && v.length <= 500},
    playSearchResult: {index: nonNegativeInt, videoID: v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v)},
};

/** Comando validado ({name, ...campos}) ou null. Aceita texto JSON ou objeto. */
export function parseCommand(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch {
            return null;
        }
    }
    if (!raw || typeof raw !== 'object' || !Object.hasOwn(SHAPES, raw.name))
        return null;
    const command = {name: raw.name};
    for (const [field, valid] of Object.entries(SHAPES[raw.name])) {
        if (!valid(raw[field]))
            return null;
        command[field] = raw[field];
    }
    return command;
}
