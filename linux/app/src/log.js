// Mensagens de diagnóstico no stderr, só com VITROLA_DEBUG=1.
import GLib from 'gi://GLib';

const enabled = Boolean(GLib.getenv('VITROLA_DEBUG'));

export function log(message) {
    if (enabled)
        printerr(`vitrola: ${message}`);
}
