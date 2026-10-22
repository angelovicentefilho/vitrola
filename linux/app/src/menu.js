// O menu da Vitrola, descrito uma vez só (design.md D7). A extensão desenha com o PopupMenu
// do GNOME Shell e o app com Gtk.PopoverMenu, os dois a partir desta mesma árvore.
// Módulo puro: recebe o estado e devolve itens; quem executa os ids é o app (menu-actions).
//
// Item: {id, label, enabled, checked?, radio?, children?}; separador: {separator: true}.

import {CHOICES, LABELS} from './prefs.js';

export const NEEDS_EXTENSION = ' (requer a extensão)';
const HEADER_MAX = 60;

function item(id, label, {enabled = true, checked} = {}) {
    const entry = {id, label, enabled};
    if (checked !== undefined)
        entry.checked = checked;
    return entry;
}

const separator = () => ({separator: true});

function header(player) {
    let text;
    if (player.track)
        text = player.track.artist ? `♪ ${player.track.title} — ${player.track.artist}` : `♪ ${player.track.title}`;
    else
        text = player.message || 'Vitrola';
    return item('header', [...text].slice(0, HEADER_MAX).join(''), {enabled: false});
}

function radioGroup(key, label, prefs) {
    return {
        id: key,
        label,
        enabled: true,
        children: CHOICES[key].map(value => ({
            ...item(`${key}:${value}`, LABELS[key][value], {checked: prefs[key] === value}),
            radio: true,
        })),
    };
}

function audioMenu(audio) {
    const current = audio.devices.find(d => d.name === audio.current);
    const children = audio.devices.length
        ? audio.devices.map(d => ({...item(`audio:${d.name}`, d.label, {checked: d.name === audio.current}), radio: true}))
        : [item('audio:none', 'Nenhum dispositivo encontrado', {enabled: false})];
    return {
        id: 'audio',
        label: current ? `Saída de áudio: ${current.label}` : 'Saída de áudio',
        enabled: true,
        children,
    };
}

/**
 * @param {object} state
 * @param {{track, message, volume}} state.player
 * @param {object} state.prefs valores do PrefsStore
 * @param {{devices: {name, label}[], current: string|null}} state.audio
 * @param {boolean} state.extensionActive
 * @param {boolean} state.autostart
 */
export function buildMenu({player, prefs, audio, extensionActive, autostart}) {
    const hasTrack = Boolean(player.track);
    const playing = player.track?.isPlaying ?? false;
    const liked = player.track?.liked ?? false;
    const placement = radioGroup('placement', 'Janela', prefs);
    if (!extensionActive) {
        const front = placement.children.find(c => c.id === 'placement:front');
        front.label += NEEDS_EXTENSION;
        front.enabled = false;
    }

    return [
        header(player),
        separator(),
        item('playPause', playing ? 'Pausar' : 'Tocar', {enabled: hasTrack}),
        item('next', 'Próxima faixa', {enabled: hasTrack}),
        item('previous', 'Faixa anterior', {enabled: hasTrack}),
        item('like', liked ? 'Descurtir' : 'Curtir', {enabled: hasTrack}),
        audioMenu(audio),
        item('volume', `Volume: ${Math.round(player.volume)}%  (role o mouse sobre a vitrola)`, {enabled: false}),
        separator(),
        extensionActive
            ? item('toggle:showNotch', 'Mostrar no notch', {checked: prefs.showNotch})
            : item('toggle:showNotch', `Mostrar no notch${NEEDS_EXTENSION}`, {checked: prefs.showNotch, enabled: false}),
        item('toggle:showFloating', 'Vitrola flutuante na tela', {checked: prefs.showFloating}),
        item('toggle:showPlaylist', 'Playlist (A seguir)', {checked: prefs.showPlaylist}),
        item('search', 'Buscar no YouTube Music…'),
        radioGroup('layout', 'Visual', prefs),
        radioGroup('size', 'Tamanho', prefs),
        placement,
        item('toggle:showTonearm', 'Braço da agulha', {checked: prefs.showTonearm}),
        item('toggle:albumColorBackground', 'Cor da capa no fundo', {checked: prefs.albumColorBackground}),
        item('toggle:showProgress', 'Barra de progresso', {checked: prefs.showProgress}),
        separator(),
        item('openYouTube', 'Abrir janela do YouTube Music'),
        item('help', 'Ajuda'),
        item('toggle:autostart', 'Abrir ao iniciar sessão', {checked: autostart}),
        separator(),
        item('about', 'Sobre a Vitrola'),
        item('quit', 'Sair da Vitrola'),
    ];
}

/** Acha um item (inclusive dentro de submenus) pelo id. */
export function findItem(menu, id) {
    for (const entry of menu) {
        if (entry.id === id)
            return entry;
        if (entry.children) {
            const found = findItem(entry.children, id);
            if (found)
                return found;
        }
    }
    return null;
}

/**
 * Interpreta um id de item para o app executar.
 * @returns {{action: string, key?: string, value?: string}|null}
 */
export function parseItemId(id) {
    if (typeof id !== 'string')
        return null;
    const [kind, ...rest] = id.split(':');
    const arg = rest.join(':');
    if (kind === 'toggle' && arg)
        return {action: 'toggle', key: arg};
    if (kind in CHOICES && CHOICES[kind].includes(arg))
        return {action: 'choose', key: kind, value: arg};
    if (kind === 'audio' && arg && arg !== 'none')
        return {action: 'audio', value: arg};
    if (['playPause', 'next', 'previous', 'like', 'search', 'openYouTube', 'help', 'about', 'quit'].includes(id))
        return {action: id};
    return null;
}
