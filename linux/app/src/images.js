// Capas e miniaturas baixadas para ~/.cache/vitrola/capas/<sha1>.jpg.
// Arquivo local porque o widget de mídia do GNOME carrega `file://` de forma confiável
// (design.md D11), e o notch, a vitrola e a playlist reaproveitam o mesmo arquivo.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

import {log} from './log.js';

const MAX_AGE_DAYS = 30;

export function defaultDir() {
    return GLib.build_filenamev([GLib.get_user_cache_dir(), 'vitrola', 'capas']);
}

export class ImageCache {
    constructor(dir = defaultDir()) {
        this._dir = dir;
        this._session = new Soup.Session({timeout: 20});
        this._inFlight = new Map();
        GLib.mkdir_with_parents(dir, 0o700);
    }

    /** Caminho local de uma URL (existindo ou não). */
    pathFor(url) {
        const name = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA1, url, -1);
        return GLib.build_filenamev([this._dir, `${name}.jpg`]);
    }

    /** Caminho local da imagem, baixando se preciso. Resolve null se não der (URL inválida, rede…). */
    fetch(url) {
        if (typeof url !== 'string' || !/^https:\/\//i.test(url))
            return Promise.resolve(null);
        const path = this.pathFor(url);
        if (GLib.file_test(path, GLib.FileTest.EXISTS))
            return Promise.resolve(path);
        if (this._inFlight.has(url))
            return this._inFlight.get(url);

        const promise = new Promise(resolve => {
            let message;
            try {
                message = Soup.Message.new('GET', url);
            } catch {
                resolve(null);
                return;
            }
            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    if (message.get_status() !== Soup.Status.OK)
                        throw new Error(`HTTP ${message.get_status()}`);
                    // Escreve num temporário e renomeia: quem ler nunca vê um arquivo pela metade.
                    const tmp = `${path}.tmp`;
                    GLib.file_set_contents(tmp, bytes.get_data());
                    GLib.rename(tmp, path);
                    resolve(path);
                } catch (e) {
                    log(`não baixou a imagem ${url}: ${e.message}`);
                    resolve(null);
                }
            });
        }).finally(() => this._inFlight.delete(url));
        this._inFlight.set(url, promise);
        return promise;
    }

    /** Apaga imagens que ninguém usa há mais de 30 dias. */
    prune(maxAgeDays = MAX_AGE_DAYS) {
        const limit = GLib.get_real_time() / 1e6 - maxAgeDays * 86400;
        try {
            const dir = Gio.File.new_for_path(this._dir);
            const children = dir.enumerate_children('standard::name,time::modified', Gio.FileQueryInfoFlags.NONE, null);
            for (let info = children.next_file(null); info; info = children.next_file(null)) {
                if (info.get_modification_date_time().to_unix() < limit)
                    dir.get_child(info.get_name()).delete(null);
            }
        } catch (e) {
            log(`não limpou o cache de imagens: ${e.message}`);
        }
    }
}
