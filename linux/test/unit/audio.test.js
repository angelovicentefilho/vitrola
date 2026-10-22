import {test, assert} from './harness.js';
import {parseDefaultSink, parseSinks} from '../../app/src/audio.js';

// Trecho real do `pactl --format=json list sinks` (Ubuntu 24.04, pulseaudio-utils 16.1).
const SAMPLE = JSON.stringify([
    {index: 1, state: 'IDLE', name: 'alsa_output.pci-0000_00_1f.3.analog-stereo', description: 'Áudio interno Estéreo analógico', mute: false},
    {index: 2, state: 'SUSPENDED', name: 'bluez_output.AA_BB.1', description: 'Fone Bluetooth'},
    {index: 3, name: 'sem_descricao', description: '  '},
    {index: 4, description: 'sem nome'},
]);

test('lista as saídas com o nome amigável', () => {
    assert.deepEqual(parseSinks(SAMPLE), [
        {name: 'alsa_output.pci-0000_00_1f.3.analog-stereo', label: 'Áudio interno Estéreo analógico'},
        {name: 'bluez_output.AA_BB.1', label: 'Fone Bluetooth'},
        {name: 'sem_descricao', label: 'sem_descricao'},
    ]);
});

test('JSON inválido ou vazio vira lista vazia', () => {
    assert.deepEqual(parseSinks(''), []);
    assert.deepEqual(parseSinks('Connection failure'), []);
    assert.deepEqual(parseSinks('{}'), []);
    assert.deepEqual(parseSinks('[]'), []);
});

test('saída padrão', () => {
    assert.equal(parseDefaultSink('bluez_output.AA_BB.1\n'), 'bluez_output.AA_BB.1');
    assert.equal(parseDefaultSink(''), null);
    assert.equal(parseDefaultSink(null), null);
});
