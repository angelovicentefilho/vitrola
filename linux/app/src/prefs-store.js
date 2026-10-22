// Guarda as preferências em ~/.config/vitrola/preferencias.json e avisa quem estiver ouvindo.

import GLib from 'gi://GLib';

import {log} from './log.js';
import {isValid, parsePrefs, serializePrefs} from './prefs.js';

export function defaultPath() {
    return GLib.build_filenamev([GLib.get_user_config_dir(), 'vitrola', 'preferencias.json']);
}

export class PrefsStore {
    constructor(path = defaultPath()) {
        this._path = path;
        this._listeners = new Map();
        this._nextListener = 1;
        let text = '';
        try {
            const [, bytes] = GLib.file_get_contents(path);
            text = new TextDecoder().decode(bytes);
        } catch {
            // Primeira abertura: fica com os padrões.
        }
        this.values = parsePrefs(text);
    }

    get(key) {
        return this.values[key];
    }

    /** Muda e salva. Valor inválido é ignorado. */
    set(key, value) {
        if (!isValid(key, value) || this.values[key] === value)
            return;
        this.values = {...this.values, [key]: value};
        this._save();
        for (const callback of this._listeners.values())
            callback(key, value);
    }

    toggle(key) {
        this.set(key, !this.values[key]);
    }

    connect(callback) {
        const id = this._nextListener++;
        this._listeners.set(id, callback);
        return id;
    }

    disconnect(id) {
        this._listeners.delete(id);
    }

    _save() {
        try {
            GLib.mkdir_with_parents(GLib.path_get_dirname(this._path), 0o700);
            GLib.file_set_contents(this._path, serializePrefs(this.values));
        } catch (e) {
            log(`não salvou as preferências: ${e.message}`);
        }
    }
}
