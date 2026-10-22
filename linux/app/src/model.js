// Estado da música e comandos ao player, lidos da página do YouTube Music a cada segundo.
// Port do PlayerModel do app do Mac. Módulo puro (sem GTK): recebe `run(js) → Promise<string>`
// do player e avisa quem estiver ouvindo (connect) quando algo muda.

import * as Scripts from './youtube/scripts.js';
import {SpinClock} from './spin.js';

export const Status = Object.freeze({
    CONNECTING: 'connecting',
    OK: 'ok',
    IDLE: 'idle',
    LOADING: 'loading',
    ERROR: 'error',
});

const MESSAGES = {
    [Status.CONNECTING]: 'Conectando ao YouTube Music…',
    [Status.IDLE]: 'Nada tocando no YouTube Music',
    [Status.LOADING]: 'Carregando o YouTube Music…',
};

const VOLUME_HOLD_MS = 1500;      // a página demora a refletir o volume que o usuário mexeu
const VOLUME_BATCH_MS = 70;       // rolagem rápida vira um envio a cada ~70 ms
const POLL_AFTER_COMMAND_MS = 400;

export class PlayerModel {
    /**
     * @param {(js: string) => Promise<string>} run executa JS na página; rejeita com
     *   Error('carregando') enquanto a página não carregou
     */
    constructor(run, {now = () => Date.now(), timers = globalThis} = {}) {
        this._run = run;
        this._now = now;
        this._timers = timers;
        this._listeners = new Map();
        this._nextListener = 1;

        this.track = null;
        this.status = Status.CONNECTING;
        this.errorMessage = '';
        this.volume = 100;
        this.lastAudibleVolume = 50;
        this.volumeChangedAt = 0;
        this.spin = new SpinClock(now);

        this._interval = null;
        this._inFlight = null;
        this._pollAgain = false;
        this._failureStreak = 0;
        this._anchorPosition = 0;
        this._anchorTime = now();
        this._volumeHoldUntil = 0;
        this._pendingVolume = null;
        this._volumeTimer = null;
    }

    get isPlaying() {
        return this.track?.isPlaying ?? false;
    }

    /** Mensagem de estado para quando não há faixa (null quando está tudo certo). */
    get message() {
        if (this.status === Status.ERROR)
            return this.errorMessage;
        return MESSAGES[this.status] ?? null;
    }

    connect(callback) {
        const id = this._nextListener++;
        this._listeners.set(id, callback);
        return id;
    }

    disconnect(id) {
        this._listeners.delete(id);
    }

    _notify() {
        for (const callback of this._listeners.values())
            callback(this);
    }

    start(intervalMs = 1000) {
        this.stop();
        this._interval = this._timers.setInterval(() => this.poll(), intervalMs);
        return this.poll();
    }

    stop() {
        if (this._interval)
            this._timers.clearInterval(this._interval);
        this._interval = null;
    }

    /** Lê o estado agora. Se já houver uma leitura em andamento, faz outra logo depois dela. */
    poll() {
        if (this._inFlight) {
            this._pollAgain = true;
            return this._inFlight;
        }
        this._inFlight = this._run(Scripts.STATE)
            .then(
                output => this._apply(Scripts.parse(output), output),
                error => this._fail(error))
            .finally(() => {
                this._inFlight = null;
                if (this._pollAgain) {
                    this._pollAgain = false;
                    this.poll();
                }
            });
        return this._inFlight;
    }

    /** Posição estimada agora, interpolando entre as leituras. */
    position(at = this._now()) {
        if (!this.track)
            return 0;
        let value = this._anchorPosition;
        if (this.track.isPlaying)
            value += (at - this._anchorTime) / 1000;
        const {duration} = this.track;
        return duration > 0 ? Math.min(Math.max(value, 0), duration) : Math.max(value, 0);
    }

    // MARK: - Comandos

    playPause() {
        if (this.track) {
            this._anchorPosition = this.position();
            this._anchorTime = this._now();
            this.track = {...this.track, isPlaying: !this.track.isPlaying};
            this.spin.set(this.track.isPlaying);
            this._notify();
        }
        return this.send({name: 'playPause'});
    }

    next() {
        return this.send({name: 'next'});
    }

    previous() {
        return this.send({name: 'previous'});
    }

    seek(seconds) {
        this._anchorPosition = seconds;
        this._anchorTime = this._now();
        if (this.track) {
            this.track = {...this.track, position: seconds};
            this._notify();
        }
        return this.send({name: 'seek', seconds});
    }

    toggleLike() {
        if (this.track) {
            this.track = {...this.track, liked: !this.track.liked};
            this._notify();
        }
        return this.send({name: 'toggleLike'});
    }

    playQueueItem(index) {
        return this.send({name: 'playQueueItem', index});
    }

    search(query) {
        return this.send({name: 'search', query}, false);
    }

    playSearchResult(index, videoID) {
        return this.send({name: 'playSearchResult', index, videoID});
    }

    setVolume(value) {
        const v = Math.min(Math.max(Number(value) || 0, 0), 100);
        if (v > 0)
            this.lastAudibleVolume = v;
        this.volume = v;
        this.volumeChangedAt = this._now();
        this._volumeHoldUntil = this._now() + VOLUME_HOLD_MS;
        this._notify();

        this._pendingVolume = Math.round(v);
        if (this._volumeTimer)
            return;
        this._volumeTimer = this._timers.setTimeout(() => {
            this._volumeTimer = null;
            const pending = this._pendingVolume;
            this._pendingVolume = null;
            if (pending !== null)
                this._run(Scripts.jsFor({name: 'setVolume', value: pending})).catch(() => {});
        }, VOLUME_BATCH_MS);
    }

    adjustVolume(delta) {
        this.setVolume(this.volume + delta);
    }

    toggleMute() {
        this.setVolume(this.volume > 0 ? 0 : this.lastAudibleVolume);
    }

    /** Executa um comando e relê o estado logo depois. Devolve a saída do script ('' se falhou). */
    send(command, pollAfter = true) {
        const done = this._run(Scripts.jsFor(command)).catch(() => '');
        if (pollAfter)
            this._timers.setTimeout(() => this.poll(), POLL_AFTER_COMMAND_MS);
        return done;
    }

    // MARK: - Estado

    _apply(snapshot, output) {
        if (!snapshot) {
            // '' = fora do YouTube Music (ex.: tela de login): sem faixa, sem erro.
            if (output === '')
                return this._setIdle();
            return this._fail(new Error('Resposta inesperada do YouTube Music'));
        }
        this._failureStreak = 0;
        if (!snapshot.title)
            return this._setIdle();

        this._anchorPosition = snapshot.position;
        this._anchorTime = this._now();
        let changed = JSON.stringify(this.track) !== JSON.stringify(snapshot);
        this.track = snapshot;
        // Não sobrescreve o volume logo depois de o usuário mexer.
        if (snapshot.volume !== null && this._now() > this._volumeHoldUntil && Math.abs(snapshot.volume - this.volume) > 0.5) {
            this.volume = snapshot.volume;
            if (snapshot.volume > 0)
                this.lastAudibleVolume = snapshot.volume;
            changed = true;
        }
        if (this.status !== Status.OK) {
            this.status = Status.OK;
            changed = true;
        }
        this.spin.set(snapshot.isPlaying);
        if (changed)
            this._notify();
    }

    _setIdle() {
        this._failureStreak = 0;
        const changed = this.track !== null || this.status !== Status.IDLE;
        this.track = null;
        this.status = Status.IDLE;
        this.spin.set(false);
        if (changed)
            this._notify();
    }

    _fail(error) {
        // Uma falha isolada não deve apagar a faixa da tela.
        this._failureStreak++;
        if (this._failureStreak < 3 && this.track)
            return;
        const loading = error?.message === 'carregando';
        const status = loading ? Status.LOADING : Status.ERROR;
        const message = loading ? '' : String(error?.message ?? error);
        const changed = this.track !== null || this.status !== status || this.errorMessage !== message;
        this.track = null;
        this.status = status;
        this.errorMessage = message;
        this.spin.set(false);
        if (changed)
            this._notify();
    }
}
