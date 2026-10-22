import {test, assert} from './harness.js';
import {buildMenu, findItem, parseItemId, NEEDS_EXTENSION} from '../../app/src/menu.js';
import {DEFAULTS} from '../../app/src/prefs.js';

const playing = {title: 'Oceano', artist: 'Djavan', isPlaying: true, liked: false};
const audio = {
    devices: [{name: 'alsa_output.interno', label: 'Alto-falantes'}, {name: 'bluez_output.fone', label: 'Fone Bluetooth'}],
    current: 'bluez_output.fone',
};

function menu(overrides = {}) {
    return buildMenu({
        player: {track: playing, message: null, volume: 70},
        prefs: {...DEFAULTS},
        audio,
        extensionActive: true,
        autostart: false,
        ...overrides,
    });
}

const labels = m => m.map(e => (e.separator ? '—' : e.label));

test('ordem dos itens do menu', () => {
    assert.deepEqual(labels(menu()), [
        '♪ Oceano — Djavan', '—',
        'Pausar', 'Próxima faixa', 'Faixa anterior', 'Curtir', 'Saída de áudio: Fone Bluetooth',
        'Volume: 70%  (role o mouse sobre a vitrola)', '—',
        'Mostrar no notch', 'Vitrola flutuante na tela', 'Playlist (A seguir)', 'Buscar no YouTube Music…',
        'Visual', 'Tamanho', 'Janela', 'Braço da agulha', 'Cor da capa no fundo', 'Barra de progresso', '—',
        'Abrir janela do YouTube Music', 'Ajuda', 'Abrir ao iniciar sessão', '—',
        'Sobre a Vitrola', 'Sair da Vitrola',
    ]);
});

test('sem faixa: cabeçalho com a mensagem e controles desabilitados', () => {
    const m = menu({player: {track: null, message: 'Nada tocando no YouTube Music', volume: 100}});
    assert.equal(m[0].label, 'Nada tocando no YouTube Music');
    for (const id of ['playPause', 'next', 'previous', 'like'])
        assert.equal(findItem(m, id).enabled, false, id);
    assert.equal(findItem(m, 'playPause').label, 'Tocar');
});

test('opções marcadas refletem as preferências', () => {
    const m = menu({prefs: {...DEFAULTS, showFloating: true, layout: 'disc'}});
    assert.equal(findItem(m, 'toggle:showFloating').checked, true);
    assert.equal(findItem(m, 'layout:disc').checked, true);
    assert.equal(findItem(m, 'layout:card').checked, false);
    assert.equal(findItem(m, 'toggle:showPlaylist').checked, false);
});

test('sem a extensão: notch e "Sempre na frente" desabilitados com a indicação', () => {
    const m = menu({extensionActive: false});
    const notch = findItem(m, 'toggle:showNotch');
    assert.equal(notch.enabled, false);
    assert.ok(notch.label.endsWith(NEEDS_EXTENSION));
    const front = findItem(m, 'placement:front');
    assert.equal(front.enabled, false);
    assert.equal(front.label, `Sempre na frente${NEEDS_EXTENSION}`);
    assert.equal(findItem(m, 'placement:normal').enabled, true);
});

test('saída de áudio marca a atual e trata lista vazia', () => {
    assert.equal(findItem(menu(), 'audio:bluez_output.fone').checked, true);
    const empty = menu({audio: {devices: [], current: null}});
    assert.equal(findItem(empty, 'audio').label, 'Saída de áudio');
    const none = findItem(empty, 'audio:none');
    assert.equal(none.label, 'Nenhum dispositivo encontrado');
    assert.equal(none.enabled, false);
});

test('cabeçalho longo é cortado em 60 caracteres', () => {
    const m = menu({player: {track: {...playing, title: 'x'.repeat(100)}, message: null, volume: 50}});
    assert.equal([...m[0].label].length, 60);
});

test('ids viram ações', () => {
    assert.deepEqual(parseItemId('toggle:showFloating'), {action: 'toggle', key: 'showFloating'});
    assert.deepEqual(parseItemId('size:large'), {action: 'choose', key: 'size', value: 'large'});
    assert.deepEqual(parseItemId('audio:bluez_output.a:b'), {action: 'audio', value: 'bluez_output.a:b'});
    assert.deepEqual(parseItemId('quit'), {action: 'quit'});
    assert.equal(parseItemId('size:huge'), null);
    assert.equal(parseItemId('audio:none'), null);
    assert.equal(parseItemId('header'), null);
    assert.equal(parseItemId(42), null);
});
