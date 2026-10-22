// Mantém o ângulo do disco contínuo entre play/pause (33⅓ rpm = 200°/s). Módulo puro.

export const DEGREES_PER_SECOND = 200;

export class SpinClock {
    constructor(now = () => Date.now()) {
        this._now = now;
        this._base = 0;
        this._since = null;
    }

    /** Ângulo em graus (0–360) no instante `at` (ms). */
    angle(at = this._now()) {
        let value = this._base;
        if (this._since !== null)
            value += (at - this._since) / 1000 * DEGREES_PER_SECOND;
        return value % 360;
    }

    set(playing) {
        const now = this._now();
        if (playing) {
            if (this._since === null)
                this._since = now;
        } else if (this._since !== null) {
            this._base = this.angle(now);
            this._since = null;
        }
    }
}
