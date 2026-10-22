import {test, assert} from './harness.js';
import * as M from '../../app/src/mpris-map.js';

const track = (extra = {}) => ({
    title: 'Oceano', artist: 'Djavan', album: 'Djavan', artworkURL: null,
    position: 10, duration: 200.5, isPlaying: true, liked: false, volume: 70, ...extra,
});

test('trackid é um caminho D-Bus válido e estável por faixa', () => {
    const id = M.trackId(track());
    assert.ok(/^\/io\/github\/vitrola\/Vitrola\/faixa\/[0-9a-f]{8}$/.test(id), id);
    assert.equal(M.trackId(track({position: 99})), id, 'posição não muda o id');
    assert.ok(M.trackId(track({title: 'Flor de Lis'})) !== id, 'outra faixa, outro id');
    assert.equal(M.trackId(null), M.NO_TRACK);
});

test('metadados completos', () => {
    assert.deepEqual(M.metadata(track(), '/home/a/.cache/vitrola/capas/x y.jpg'), {
        'mpris:trackid': ['o', M.trackId(track())],
        'xesam:title': ['s', 'Oceano'],
        'xesam:artist': ['as', ['Djavan']],
        'xesam:album': ['s', 'Djavan'],
        'mpris:length': ['x', 200500000],
        'mpris:artUrl': ['s', 'file:///home/a/.cache/vitrola/capas/x%20y.jpg'],
    });
});

test('metadados sem capa, artista, álbum ou duração omitem os campos', () => {
    assert.deepEqual(M.metadata(track({artist: '', album: '', duration: 0})), {
        'mpris:trackid': ['o', M.trackId(track({artist: '', album: '', duration: 0}))],
        'xesam:title': ['s', 'Oceano'],
    });
    assert.deepEqual(M.metadata(null), {'mpris:trackid': ['o', M.NO_TRACK]});
});

test('estado de reprodução', () => {
    assert.equal(M.playbackStatus(track()), 'Playing');
    assert.equal(M.playbackStatus(track({isPlaying: false})), 'Paused');
    assert.equal(M.playbackStatus(null), 'Stopped');
});

test('volume 0–100 ↔ 0,0–1,0', () => {
    assert.equal(M.volumeToMpris(70), 0.7);
    assert.equal(M.volumeFromMpris(0.5), 50);
    assert.equal(M.volumeFromMpris(1.7), 100);
    assert.equal(M.volumeFromMpris(-1), 0);
    assert.equal(M.volumeToMpris(null), 0);
});

test('microssegundos', () => {
    assert.equal(M.toMicros(1.5), 1500000);
    assert.equal(M.toMicros(-3), 0);
});

test('detector de saltos: tocando normal não avisa; busca e nova faixa avisam', () => {
    const d = new M.SeekDetector();
    assert.equal(d.update(track({position: 10}), 10, 0), null, 'primeira leitura');
    assert.equal(d.update(track({position: 11}), 11, 1000), null, 'andou 1 s em 1 s');
    assert.equal(d.update(track({position: 60}), 60, 2000), 60, 'pulou para 60');
    assert.equal(d.update(track({title: 'Outra', position: 0.4}), 0.4, 3000), 0.4, 'nova faixa');
});

test('detector de saltos: pausado não espera avanço', () => {
    const d = new M.SeekDetector();
    d.update(track({isPlaying: false}), 30, 0);
    assert.equal(d.update(track({isPlaying: false}), 30, 5000), null);
    assert.equal(d.update(track({isPlaying: false}), 90, 6000), 90);
});
