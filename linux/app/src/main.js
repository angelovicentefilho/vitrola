// Ponto de entrada da Vitrola para Linux: gjs -m linux/app/src/main.js
// Instância única via Gtk.Application: rodar `vitrola` de novo repassa o pedido para a que já está aberta.
//
//   vitrola                     abre (ou mostra) a janela do YouTube Music
//   vitrola --em-segundo-plano  inicia com a janela escondida (usado ao iniciar a sessão)
//   vitrola --buscar            abre a busca (para um atalho personalizado do GNOME)
//   vitrola --playlist          abre a playlist "A seguir"

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import System from 'system';

import {Vitrola} from './app.js';
import {APP_ID} from './desktop-entry.js';
import {log} from './log.js';

const app = new Gtk.Application({
    application_id: APP_ID,
    flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
});
GLib.set_application_name('Vitrola');

const option = (name, description) =>
    app.add_main_option(name, 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, description, null);
option('em-segundo-plano', 'Inicia sem mostrar a janela do YouTube Music');
option('buscar', 'Abre a busca no YouTube Music');
option('playlist', 'Abre a playlist "A seguir"');

const vitrola = new Vitrola(app);
app.connect('startup', () => vitrola.startup());

app.connect('command-line', (_app, commandLine) => {
    const options = commandLine.get_options_dict();
    if (options.contains('buscar')) {
        log('abrindo a busca');
        vitrola.showSearch();
    } else if (options.contains('playlist')) {
        log('abrindo a playlist');
        vitrola.showPlaylist();
    } else if (options.contains('em-segundo-plano')) {
        log('iniciou em segundo plano');
    } else {
        log('mostrando a janela');
        vitrola.player.mostrar();
    }
    return 0;
});

if (GLib.getenv('VITROLA_DEBUG'))
    app.connect('startup', () => logStateChanges());

/** Diagnóstico (VITROLA_DEBUG): registra mudanças de estado; o teste de fumaça procura estas linhas. */
function logStateChanges() {
    let last = '';
    vitrola.model.connect(m => {
        const line = m.track
            ? `estado: ${m.status} "${m.track.title}" — ${m.track.artist} (${m.isPlaying ? 'tocando' : 'pausado'})`
            : `estado: ${m.status} ${m.message ?? ''}`.trim();
        if (line !== last)
            log(line);
        last = line;
    });
}

const status = await app.runAsync([System.programInvocationName, ...ARGV]);
System.exit(status);
