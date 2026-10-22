// Só no GJS, com um PulseAudio de verdade: o smoke.sh sobe um com duas saídas virtuais.
import GLib from 'gi://GLib';
import {test, assert} from './harness.js';
import {AudioOutput} from '../../app/src/audio-output.js';

const hasPulse = GLib.find_program_in_path('pactl') && GLib.getenv('VITROLA_TESTE_AUDIO');

test('lista, troca e recusa saída inexistente (precisa de VITROLA_TESTE_AUDIO=1)', async () => {
    if (!hasPulse)
        return;
    const audio = await new AudioOutput().refresh();
    const names = audio.devices.map(d => d.name);
    assert.ok(names.includes('fone') && names.includes('tv'), `saídas: ${names}`);
    await audio.select('tv');
    await audio.refresh();
    assert.equal(audio.current, 'tv');
    let refused = false;
    try {
        await audio.select('nao_existe');
    } catch {
        refused = true;
    }
    assert.ok(refused, 'saída inexistente deve ser recusada');
});
