import {test, assert} from './harness.js';
import * as G from '../../app/src/vinyl-geometry.js';

test('braço: parado fora do disco, tocando avança da borda ao selo', () => {
    assert.equal(G.armAngle(null), 4);
    assert.equal(G.armAngle({isPlaying: false, position: 50, duration: 100}), 4);
    assert.equal(G.armAngle({isPlaying: true, position: 0, duration: 100}), 18.5);
    assert.equal(G.armAngle({isPlaying: true, position: 50, duration: 100}), 25.75);
    assert.equal(G.armAngle({isPlaying: true, position: 500, duration: 100}), 33);
    assert.equal(G.armAngle({isPlaying: true, position: 10, duration: 0}), 18.5);
});

test('medidas da janela batem com as do Mac', () => {
    const disc = G.floatingMetrics(210, 'disc');
    assert.equal(disc.width, Math.round(210 * 1.16 + 28));
    assert.equal(disc.height, 238);
    const card = G.floatingMetrics(210, 'card');
    assert.equal(card.width, Math.round(28 + 32 + 243.6 + 18 + 18 + 18 + 220.5));
    assert.equal(card.height, 270);
    assert.equal(G.floatingMetrics(150, 'card').textWidth, 190, 'coluna de texto tem um mínimo');
});

test('cor do cartão escurece mais as capas claras', () => {
    assert.deepEqual(G.cardBackground([200, 100, 50]), [90, 45, 22]);
    assert.deepEqual(G.cardBackground([100, 50, 20]), [65, 33, 13]);
});

test('formatação de tempo', () => {
    assert.equal(G.formatTime(0), '0:00');
    assert.equal(G.formatTime(65.9), '1:05');
    assert.equal(G.formatTime(3723), '1:02:03');
    assert.equal(G.formatTime(-5), '0:00');
});

test('ícone e passo do volume', () => {
    assert.equal(G.volumeIcon(0), 'audio-volume-muted-symbolic');
    assert.equal(G.volumeIcon(20), 'audio-volume-low-symbolic');
    assert.equal(G.volumeIcon(50), 'audio-volume-medium-symbolic');
    assert.equal(G.volumeIcon(90), 'audio-volume-high-symbolic');
    assert.equal(G.scrollVolumeDelta(1, true), -5);
    assert.equal(G.scrollVolumeDelta(-4, false), 2);
});
