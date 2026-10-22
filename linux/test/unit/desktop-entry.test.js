import {test, assert} from './harness.js';
import {desktopEntry, quoteExecArg} from '../../app/src/desktop-entry.js';

test('argumentos do Exec ficam entre aspas e com escapes', () => {
    assert.equal(quoteExecArg('/home/ana/.local/bin/vitrola'), '"/home/ana/.local/bin/vitrola"');
    assert.equal(quoteExecArg('/home/a b/$x"`\\'), '"/home/a b/\\$x\\"\\`\\\\"');
});

test('autostart inicia em segundo plano e não aparece no menu de apps', () => {
    const entry = desktopEntry(['/home/ana/.local/bin/vitrola'], {autostart: true});
    assert.ok(entry.includes('Exec="/home/ana/.local/bin/vitrola" --em-segundo-plano\n'));
    assert.ok(entry.includes('X-GNOME-Autostart-enabled=true\n'));
    assert.ok(entry.includes('NoDisplay=true\n'));
    assert.ok(entry.startsWith('[Desktop Entry]\n'));
});

test('entrada do menu de apps abre normalmente', () => {
    const entry = desktopEntry(['gjs', '-m', '/opt/vitrola/main.js']);
    assert.ok(entry.includes('Exec="gjs" "-m" "/opt/vitrola/main.js"\n'));
    assert.ok(!entry.includes('NoDisplay'));
    assert.ok(entry.includes('StartupWMClass=io.github.vitrola.Vitrola\n'));
});
