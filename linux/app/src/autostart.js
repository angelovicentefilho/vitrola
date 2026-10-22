// "Abrir ao iniciar sessão": um .desktop em ~/.config/autostart (design.md D13).

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {APP_ID, desktopEntry} from './desktop-entry.js';
import {log} from './log.js';

function autostartPath() {
    return GLib.build_filenamev([GLib.get_user_config_dir(), 'autostart', `${APP_ID}.desktop`]);
}

/**
 * Comando que abre esta Vitrola: o lançador (bin/vitrola exporta VITROLA_LAUNCHER) ou,
 * rodando direto pelo gjs, o próprio main.js.
 */
export function launcherCommand() {
    const launcher = GLib.getenv('VITROLA_LAUNCHER');
    if (launcher)
        return [launcher];
    const main = GLib.build_filenamev([GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]), 'main.js']);
    return [GLib.find_program_in_path('gjs') ?? 'gjs', '-m', main];
}

export function isEnabled() {
    return GLib.file_test(autostartPath(), GLib.FileTest.EXISTS);
}

export function setEnabled(enabled) {
    const path = autostartPath();
    try {
        if (enabled) {
            GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o755);
            GLib.file_set_contents(path, desktopEntry(launcherCommand(), {autostart: true}));
        } else if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            Gio.File.new_for_path(path).delete(null);
        }
        log(`abrir ao iniciar sessão: ${enabled ? 'ligado' : 'desligado'}`);
    } catch (e) {
        log(`não mudou o autostart: ${e.message}`);
    }
}
