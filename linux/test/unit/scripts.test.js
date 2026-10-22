import {test, assert} from './harness.js';
import * as S from '../../app/src/youtube/scripts.js';

const COMMANDS = [
    {name: 'playPause'},
    {name: 'next'},
    {name: 'previous'},
    {name: 'toggleLike'},
    {name: 'seek', seconds: 61.239},
    {name: 'setVolume', value: 42},
    {name: 'playQueueItem', index: 3},
    {name: 'search', query: 'Djavan "Oceano" \\ \n'},
    {name: 'playSearchResult', index: 2, videoID: "abc'\"123"},
];

test('todos os scripts são JavaScript válido', () => {
    for (const js of [S.STATE, S.QUEUE, S.SEARCH_RESULTS, S.PAUSE, ...COMMANDS.map(S.jsFor)])
        new Function(`return ${js};`);     // lança SyntaxError se o script estiver quebrado
});

test('scripts ficam numa linha só', () => {
    assert.ok(!S.STATE.includes('\n'));
    assert.ok(S.QUEUE.includes("split('\\u2022')"), 'o separador da fila continua escapado como no Swift');
});

test('seek usa duas casas e não aceita negativo', () => {
    assert.ok(S.jsFor({name: 'seek', seconds: 61.239}).includes('seekTo(61.24, true)'));
    assert.ok(S.jsFor({name: 'seek', seconds: -5}).includes('seekTo(0.00, true)'));
});

test('volume é limitado a 0–100', () => {
    assert.ok(S.jsFor({name: 'setVolume', value: 150}).startsWith('(function(){ var v = 100;'));
    assert.ok(S.jsFor({name: 'setVolume', value: -3}).startsWith('(function(){ var v = 0;'));
});

test('busca escapa o texto digitado', () => {
    const js = S.jsFor({name: 'search', query: 'a"b\'c'});
    assert.ok(js.includes('var q = "a\\"b\'c";'));
});

test('comando desconhecido lança erro', () => {
    let threw = false;
    try {
        S.jsFor({name: 'dançar'});
    } catch {
        threw = true;
    }
    assert.ok(threw);
});

test('parse lê o estado do player', () => {
    const out = JSON.stringify({
        title: 'Oceano', artist: 'Djavan', album: 'Djavan', art: 'https://lh3.googleusercontent.com/x=w120-h120-l90-rj',
        cur: 12.5, dur: 240, playing: true, liked: true, vol: 70,
    });
    assert.deepEqual(S.parse(out), {
        title: 'Oceano', artist: 'Djavan', album: 'Djavan',
        artworkURL: 'https://lh3.googleusercontent.com/x=w800-h800-l90-rj',
        position: 12.5, duration: 240, isPlaying: true, liked: true, volume: 70,
    });
});

test('parse tolera campos faltando e rejeita lixo', () => {
    assert.deepEqual(S.parse('{}'), {
        title: '', artist: '', album: '', artworkURL: null,
        position: 0, duration: 0, isPlaying: false, liked: false, volume: null,
    });
    assert.equal(S.parse(''), null);
    assert.equal(S.parse('not json'), null);
    assert.equal(S.parse('[1,2]'), null);
});

test('largeArtwork ignora data: e vazio', () => {
    assert.equal(S.largeArtwork('data:image/png;base64,AAA'), null);
    assert.equal(S.largeArtwork(''), null);
    assert.equal(S.largeArtwork('https://i.ytimg.com/vi/x/hq.jpg'), 'https://i.ytimg.com/vi/x/hq.jpg');
});

test('parseQueue mapeia a fila', () => {
    const out = JSON.stringify([
        {i: 0, title: 'A', artist: 'X', dur: '3:05', thumb: 'https://a/x=w60-h60', cur: false},
        {i: 2, title: 'B', artist: 'Y', dur: '1:02:03', thumb: '', cur: true},
    ]);
    assert.deepEqual(S.parseQueue(out), [
        {index: 0, title: 'A', artist: 'X', duration: '3:05', thumbnailURL: 'https://a/x=w120-h120', isCurrent: false},
        {index: 2, title: 'B', artist: 'Y', duration: '1:02:03', thumbnailURL: null, isCurrent: true},
    ]);
    assert.deepEqual(S.parseQueue('oops'), []);
});

test('durationSeconds entende m:ss e h:mm:ss', () => {
    assert.equal(S.durationSeconds('3:05'), 185);
    assert.equal(S.durationSeconds('1:02:03'), 3723);
    assert.equal(S.durationSeconds(''), 0);
});

test('parseSearch descarta itens sem id e troca o separador', () => {
    const out = JSON.stringify({ready: true, q: 'djavan', items: [
        {i: 1, id: 'abc', title: 'Oceano', sub: 'Música • Djavan • 3:50', thumb: 'https://t/x=w60-h60'},
        {i: 4, id: '', title: 'Álbum', sub: 'Álbum', thumb: ''},
    ]});
    assert.deepEqual(S.parseSearch(out), {ready: true, query: 'djavan', items: [
        {index: 1, videoID: 'abc', title: 'Oceano', subtitle: 'Música · Djavan · 3:50', thumbnailURL: 'https://t/x=w120-h120'},
    ]});
    assert.deepEqual(S.parseSearch('x'), {ready: false, query: '', items: []});
});
