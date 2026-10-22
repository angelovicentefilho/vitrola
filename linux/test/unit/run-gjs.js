// Roda os testes unitários no GJS: gjs -m linux/test/unit/run-gjs.js
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import System from 'system';
import {runPending} from './harness.js';

const dir = GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]);
const names = [];
const children = Gio.File.new_for_path(dir).enumerate_children('standard::name', 0, null);
for (let info = children.next_file(null); info; info = children.next_file(null)) {
    // *.test.js rodam no Node e no GJS; *.gjstest.js só no GJS (usam GLib, Soup…).
    if (info.get_name().endsWith('.test.js') || info.get_name().endsWith('.gjstest.js'))
        names.push(info.get_name());
}
names.sort();

for (const name of names)
    await import(`./${name}`);

const failed = await runPending(print);
System.exit(failed > 0 ? 1 : 0);
