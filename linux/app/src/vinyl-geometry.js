// Medidas e cores da vitrola, iguais às do app do Mac (TurntableViews.swift, RootView.swift).
// Módulo puro: usado pela vitrola flutuante e pela extensão do notch.

/** Ângulos do braço da agulha (graus, horário a partir de "apontando para baixo"). */
export const ARM = Object.freeze({rest: 4, start: 18.5, end: 33});

/** O conjunto toca-discos ocupa (1,16 × d) por d: o braço fica à direita do disco. */
export const TURNTABLE_WIDTH_FACTOR = 1.16;

/** Ângulo do braço: fora do disco parado; da borda até perto do selo conforme a música avança. */
export function armAngle(track) {
    if (!track || !track.isPlaying)
        return ARM.rest;
    const progress = track.duration > 0 ? Math.min(Math.max(track.position / track.duration, 0), 1) : 0;
    return ARM.start + (ARM.end - ARM.start) * progress;
}

/** Medidas da janela flutuante para um diâmetro e visual ("disc" ou "card"). */
export function floatingMetrics(d, layout) {
    const pad = 14;
    const inner = 16;
    const gap = 18;
    const volumeWidth = 18;
    const turntableWidth = d * TURNTABLE_WIDTH_FACTOR;
    const textWidth = Math.max(190, d * 1.05);
    const size = layout === 'disc'
        ? {width: turntableWidth + pad * 2, height: d + pad * 2}
        : {width: pad * 2 + inner * 2 + turntableWidth + gap + volumeWidth + gap + textWidth, height: pad * 2 + inner * 2 + d};
    return {d, pad, inner, gap, volumeWidth, turntableWidth, textWidth, scale: d / 210,
        width: Math.round(size.width), height: Math.round(size.height)};
}

/** Cor de fundo do cartão a partir da cor média da capa: escurecida para o texto branco ficar legível. */
export function cardBackground([r, g, b]) {
    const brightness = Math.max(r, g, b) / 255;
    const fraction = brightness > 0.55 ? 0.55 : 0.35;
    return [r, g, b].map(c => Math.round(c * (1 - fraction)));
}

export const DEFAULT_CARD = [41, 41, 41];   // cinza 0,16 do Mac

/** "m:ss" ou "h:mm:ss". */
export function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Ícone simbólico do alto-falante para um volume. */
export function volumeIcon(volume) {
    if (volume <= 0)
        return 'audio-volume-muted-symbolic';
    if (volume < 34)
        return 'audio-volume-low-symbolic';
    if (volume < 67)
        return 'audio-volume-medium-symbolic';
    return 'audio-volume-high-symbolic';
}

/** Quanto a rolagem muda o volume: roda do mouse em "cliques", touchpad em pixels. */
export function scrollVolumeDelta(dy, isWheel) {
    return -dy * (isWheel ? 5 : 0.5);
}
