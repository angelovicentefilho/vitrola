// Escolha da saída de áudio do sistema pelo `pactl` (PipeWire/PulseAudio).
// Trocar a saída padrão é o mesmo que as Configurações Rápidas do GNOME fazem.

import Gio from 'gi://Gio';

import {log} from './log.js';
import {parseDefaultSink, parseSinks} from './audio.js';

/** Executa o pactl e devolve a saída padrão; rejeita com a mensagem de erro dele. */
function pactl(args) {
    return new Promise((resolve, reject) => {
        let proc;
        try {
            proc = Gio.Subprocess.new(['pactl', ...args],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        } catch (e) {
            reject(new Error(`pactl indisponível: ${e.message}`));
            return;
        }
        proc.communicate_utf8_async(null, null, (p, result) => {
            try {
                const [, stdout, stderr] = p.communicate_utf8_finish(result);
                if (p.get_successful())
                    resolve(stdout ?? '');
                else
                    reject(new Error((stderr ?? '').trim() || `pactl saiu com ${p.get_exit_status()}`));
            } catch (e) {
                reject(e);
            }
        });
    });
}

export class AudioOutput {
    constructor() {
        this.devices = [];
        this.current = null;
    }

    /** Relê a lista e a saída atual. Em caso de erro, fica com a lista vazia. */
    async refresh() {
        try {
            const [list, current] = await Promise.all([
                pactl(['--format=json', 'list', 'sinks']),
                pactl(['get-default-sink']),
            ]);
            this.devices = parseSinks(list);
            this.current = parseDefaultSink(current);
        } catch (e) {
            log(`não li as saídas de áudio: ${e.message}`);
            this.devices = [];
            this.current = null;
        }
        return this;
    }

    /** Torna `name` a saída padrão. Rejeita se o sistema recusar. */
    async select(name) {
        await pactl(['set-default-sink', name]);
        this.current = name;
        log(`saída de áudio: ${name}`);
    }
}
