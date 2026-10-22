// Só no GJS: confere o Gio.Menu e as ações montados a partir do menu.js.
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {test, assert} from './harness.js';
import {buildMenu} from '../../app/src/menu.js';
import {buildMenuModel} from '../../app/src/menu-view.js';
import {DEFAULTS} from '../../app/src/prefs.js';

function tree(extensionActive = true) {
    return buildMenu({
        player: {track: {title: 'Oceano', artist: 'Djavan', isPlaying: true, liked: false}, message: null, volume: 70},
        prefs: {...DEFAULTS},
        audio: {devices: [{name: 'fone', label: 'Fone'}, {name: 'tv', label: 'TV'}], current: 'tv'},
        extensionActive,
        autostart: true,
    });
}

/** Lista [rótulo, ação, alvo] de todos os itens, entrando em seções e submenus. */
function flatten(model, out = []) {
    for (let i = 0; i < model.get_n_items(); i++) {
        const label = model.get_item_attribute_value(i, 'label', null)?.unpack() ?? null;
        const action = model.get_item_attribute_value(i, 'action', null)?.unpack() ?? null;
        const target = model.get_item_attribute_value(i, 'target', null)?.unpack() ?? null;
        if (label)
            out.push([label, action, target]);
        for (const link of ['section', 'submenu']) {
            const child = model.get_item_link(i, link);
            if (child)
                flatten(child, out);
        }
    }
    return out;
}

test('seções, submenus e itens desabilitados sem ação', () => {
    const {model} = buildMenuModel(tree(), () => {});
    assert.equal(model.get_n_items(), 5, 'quatro separadores = cinco seções');
    const items = flatten(model);
    const header = items.find(([label]) => label === '♪ Oceano — Djavan');
    assert.equal(header[1], null, 'cabeçalho sem ação = desabilitado');
    const pause = items.find(([label]) => label === 'Pausar');
    assert.deepEqual(pause, ['Pausar', 'vm.item', 'playPause']);
    assert.ok(items.some(([label, action, target]) => label === 'TV' && action.startsWith('vm.radio-') && target === 'audio:tv'));
});

test('ativar itens chama o callback com o id', () => {
    const activated = [];
    const {model, actions} = buildMenuModel(tree(), id => activated.push(id));
    actions.activate_action('item', new GLib.Variant('s', 'next'));
    const items = flatten(model);
    const [, floatingAction] = items.find(([label]) => label === 'Vitrola flutuante na tela');
    actions.activate_action(floatingAction.replace('vm.', ''), null);
    const [, sizeAction] = items.find(([label]) => label === 'Grande');
    actions.activate_action(sizeAction.replace('vm.', ''), new GLib.Variant('s', 'size:large'));
    assert.deepEqual(activated, ['next', 'toggle:showFloating', 'size:large']);
});

test('caixas de seleção e rádios refletem o estado', () => {
    const {model, actions} = buildMenuModel(tree(), () => {});
    const items = flatten(model);
    const [, autostartAction] = items.find(([label]) => label === 'Abrir ao iniciar sessão');
    assert.equal(actions.get_action_state(autostartAction.replace('vm.', '')).unpack(), true);
    const [, audioAction] = items.find(([label]) => label === 'TV');
    assert.equal(actions.get_action_state(audioAction.replace('vm.', '')).unpack(), 'audio:tv');
});

test('sem a extensão, "Sempre na frente" fica sem ação', () => {
    const items = flatten(buildMenuModel(tree(false), () => {}).model);
    const front = items.find(([label]) => label.startsWith('Sempre na frente'));
    assert.equal(front[1], null);
    assert.ok(Gio.Menu !== undefined);
});
