import {test, assert} from './harness.js';
import {PlayerModel, Status} from '../../app/src/model.js';
import {SpinClock} from '../../app/src/spin.js';
import * as Scripts from '../../app/src/youtube/scripts.js';

/** Relógio e timers manuais: nada roda sozinho. */
function fakeClock() {
    let now = 1_000_000;
    let nextId = 1;
    const pending = new Map();
    return {
        now: () => now,
        advance(ms) {
            now += ms;
            for (const [id, t] of [...pending]) {
                if (t.at <= now) {
                    pending.delete(id);
                    t.fn();
                }
            }
        },
        timers: {
            setTimeout: (fn, ms) => {
                const id = nextId++;
                pending.set(id, {fn, at: now + ms});
                return id;
            },
            clearTimeout: id => pending.delete(id),
            setInterval: () => nextId++,
            clearInterval: () => {},
        },
    };
}

/** Player falso: responde ao script de estado com `state` e guarda os comandos. */
function fakePlayer() {
    const fake = {
        state: '',
        error: null,
        commands: [],
        run: js => {
            if (fake.error)
                return Promise.reject(fake.error);
            if (js === Scripts.STATE)
                return Promise.resolve(fake.state);
            fake.commands.push(js);
            return Promise.resolve('ok');
        },
    };
    return fake;
}

const snapshot = (extra = {}) => JSON.stringify({
    title: 'Oceano', artist: 'Djavan', album: '', art: '', cur: 10, dur: 200, playing: true, liked: false, vol: 70, ...extra,
});

function setup() {
    const clock = fakeClock();
    const player = fakePlayer();
    const model = new PlayerModel(player.run, {now: clock.now, timers: clock.timers});
    return {clock, player, model};
}

test('faixa tocando: estado ok, volume lido e posição que avança', async () => {
    const {clock, player, model} = setup();
    player.state = snapshot();
    let notified = 0;
    model.connect(() => notified++);
    await model.poll();
    assert.equal(model.status, Status.OK);
    assert.equal(model.track.title, 'Oceano');
    assert.equal(model.volume, 70);
    assert.equal(model.message, null);
    assert.equal(notified, 1);
    clock.advance(2000);
    assert.equal(model.position(), 12);
});

test('fora do YouTube Music (resposta vazia): sem faixa e sem erro', async () => {
    const {player, model} = setup();
    player.state = '';
    await model.poll();
    assert.equal(model.track, null);
    assert.equal(model.status, Status.IDLE);
    assert.equal(model.message, 'Nada tocando no YouTube Music');
});

test('página carregando vira status de carregamento', async () => {
    const {player, model} = setup();
    player.error = new Error('carregando');
    await model.poll();
    assert.equal(model.status, Status.LOADING);
    assert.equal(model.message, 'Carregando o YouTube Music…');
});

test('uma falha isolada não apaga a faixa; três seguidas apagam', async () => {
    const {player, model} = setup();
    player.state = snapshot();
    await model.poll();
    player.error = new Error('ocupado');
    await model.poll();
    await model.poll();
    assert.equal(model.track?.title, 'Oceano');
    await model.poll();
    assert.equal(model.track, null);
    assert.equal(model.status, Status.ERROR);
    assert.equal(model.message, 'ocupado');
});

test('pausar atualiza na hora e envia o comando', async () => {
    const {clock, player, model} = setup();
    player.state = snapshot();
    await model.poll();
    clock.advance(1000);
    model.playPause();
    assert.equal(model.isPlaying, false);
    assert.equal(model.position(), 11);
    clock.advance(5000);
    assert.equal(model.position(), 11, 'pausado, a posição não anda');
    assert.equal(player.commands[0], Scripts.jsFor({name: 'playPause'}));
});

test('ir para 60 s envia seekTo(60.00)', async () => {
    const {player, model} = setup();
    player.state = snapshot();
    await model.poll();
    model.seek(60);
    assert.equal(model.position(), 60);
    assert.ok(player.commands[0].includes('seekTo(60.00, true)'));
});

test('volume: agrupa a rolagem num envio e segura o valor por 1,5 s', async () => {
    const {clock, player, model} = setup();
    player.state = snapshot({vol: 70});
    await model.poll();
    model.adjustVolume(5);
    model.adjustVolume(5);
    model.adjustVolume(5);
    assert.equal(model.volume, 85);
    assert.equal(player.commands.length, 0);
    clock.advance(70);
    assert.equal(player.commands.length, 1);
    assert.ok(player.commands[0].startsWith('(function(){ var v = 85;'));
    await model.poll();
    assert.equal(model.volume, 85, 'a leitura antiga (70) não sobrescreve logo depois');
    clock.advance(2000);
    await model.poll();
    assert.equal(model.volume, 70);
});

test('silenciar e voltar ao último volume audível', async () => {
    const {player, model} = setup();
    player.state = snapshot({vol: 40});
    await model.poll();
    model.toggleMute();
    assert.equal(model.volume, 0);
    model.toggleMute();
    assert.equal(model.volume, 40);
});

test('comandos de fila, busca e resultado geram o JS certo', async () => {
    const {player, model} = setup();
    model.playQueueItem(4);
    model.search('djavan');
    model.playSearchResult(1, 'abc');
    await Promise.resolve();
    assert.deepEqual(player.commands, [
        Scripts.jsFor({name: 'playQueueItem', index: 4}),
        Scripts.jsFor({name: 'search', query: 'djavan'}),
        Scripts.jsFor({name: 'playSearchResult', index: 1, videoID: 'abc'}),
    ]);
});

test('o disco gira a 200°/s e retoma do mesmo ângulo depois da pausa', () => {
    let now = 0;
    const spin = new SpinClock(() => now);
    spin.set(true);
    now = 1000;
    assert.equal(spin.angle(), 200);
    spin.set(false);
    now = 9000;
    assert.equal(spin.angle(), 200);
    spin.set(true);
    now = 9500;
    assert.equal(spin.angle(), 300);
});
