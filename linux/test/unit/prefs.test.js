import {test, assert} from './harness.js';
import {DEFAULTS, isValid, parsePrefs, serializePrefs} from '../../app/src/prefs.js';

test('primeira abertura: padrões do Mac', () => {
    assert.deepEqual(parsePrefs(''), {
        showNotch: true, showFloating: false, showPlaylist: false, layout: 'card', size: 'medium',
        placement: 'front', showTonearm: true, albumColorBackground: true, showProgress: true,
    });
});

test('arquivo corrompido volta ao padrão', () => {
    assert.deepEqual(parsePrefs('{"showNotch": fals'), {...DEFAULTS});
    assert.deepEqual(parsePrefs('[1,2,3]'), {...DEFAULTS});
    assert.deepEqual(parsePrefs('null'), {...DEFAULTS});
});

test('valores salvos válidos são mantidos; inválidos e desconhecidos não', () => {
    const prefs = parsePrefs(JSON.stringify({
        showFloating: true, size: 'large', layout: 'disco', placement: 'desktop', showNotch: 'sim', extra: 1,
    }));
    assert.equal(prefs.showFloating, true);
    assert.equal(prefs.size, 'large');
    assert.equal(prefs.layout, 'card', 'layout inválido volta ao padrão');
    assert.equal(prefs.placement, 'front', '"Na mesa" não existe no Linux');
    assert.equal(prefs.showNotch, true, 'tipo errado volta ao padrão');
    assert.ok(!('extra' in prefs));
});

test('isValid confere chave, opção e tipo', () => {
    assert.ok(isValid('size', 'small'));
    assert.ok(!isValid('size', 'huge'));
    assert.ok(isValid('showTonearm', false));
    assert.ok(!isValid('showTonearm', 0));
    assert.ok(!isValid('qualquer', true));
});

test('serializar e ler de novo dá o mesmo resultado', () => {
    const prefs = {...DEFAULTS, size: 'small', showPlaylist: true};
    assert.deepEqual(parsePrefs(serializePrefs(prefs)), prefs);
});
