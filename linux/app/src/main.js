// Ponto de entrada da Vitrola para Linux: gjs -m linux/app/src/main.js
// Instância única via Gtk.Application: abrir de novo só mostra a janela existente.

import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import System from 'system';

import {log} from './log.js';
import {WebPlayer} from './player.js';

export const APP_ID = 'io.github.vitrola.Vitrola';

const app = new Gtk.Application({application_id: APP_ID});
GLib.set_application_name('Vitrola');

let player = null;

app.connect('startup', () => {
    player = new WebPlayer(app);
    player.carregar();
});

app.connect('activate', () => {
    player.mostrar();
    if (GLib.getenv('VITROLA_DEBUG'))
        logPageTitle();
});

/** Diagnóstico do teste de fumaça: confirma que o JS da página responde. */
function logPageTitle() {
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
        player.executarJS('document.title')
            .then(title => {
                if (title)
                    log(`título da página: ${title}`);
                else
                    return Promise.reject(new Error('fora do YouTube Music'));
            })
            .catch(() => logPageTitle());
        return GLib.SOURCE_REMOVE;
    });
}

const status = await app.runAsync([System.programInvocationName, ...ARGV]);
System.exit(status);
