// Preferências da Vitrola: valores aceitos, padrões e leitura tolerante.
// Os padrões são os do Mac, menos a vitrola flutuante, que no Linux vem ligada (design.md D12b).
// Módulo puro; quem lê e grava o arquivo é o prefs-store.js.

export const CHOICES = Object.freeze({
    placement: ['front', 'normal'],
    size: ['small', 'medium', 'large'],
    layout: ['disc', 'card'],
});

export const DEFAULTS = Object.freeze({
    showNotch: true,
    showFloating: true,
    showPlaylist: false,
    layout: 'card',
    size: 'medium',
    placement: 'front',
    showTonearm: true,
    albumColorBackground: true,
    showProgress: true,
});

export const LABELS = Object.freeze({
    placement: {front: 'Sempre na frente', normal: 'Janela normal'},
    size: {small: 'Pequeno', medium: 'Médio', large: 'Grande'},
    layout: {disc: 'Só o disco', card: 'Cartão com informações'},
});

/** Diâmetro do disco (px) por tamanho, como no Mac. */
export const DISC_DIAMETER = Object.freeze({small: 150, medium: 210, large: 280});

/** O valor é aceito para essa chave? */
export function isValid(key, value) {
    if (!(key in DEFAULTS))
        return false;
    if (key in CHOICES)
        return CHOICES[key].includes(value);
    return typeof value === typeof DEFAULTS[key];
}

/** Lê o JSON salvo; chaves desconhecidas ou valores inválidos voltam ao padrão. */
export function parsePrefs(text) {
    let raw = null;
    try {
        raw = JSON.parse(text);
    } catch {
        raw = null;
    }
    const prefs = {...DEFAULTS};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const key of Object.keys(DEFAULTS)) {
            if (isValid(key, raw[key]))
                prefs[key] = raw[key];
        }
    }
    return prefs;
}

export function serializePrefs(prefs) {
    return `${JSON.stringify(parsePrefs(JSON.stringify(prefs)), null, 2)}\n`;
}
