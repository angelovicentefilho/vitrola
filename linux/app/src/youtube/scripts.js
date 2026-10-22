// Scripts que a Vitrola executa na página do YouTube Music, e os parsers das respostas.
//
// ORIGEM: cópia do enum `Scripts` de Sources/Vitrola/YouTubeMusicBridge.swift (app do Mac),
// referência no commit 90a2c65. Se o YouTube Music mudar o HTML e os seletores forem
// corrigidos lá, corrija aqui também (até existir a pasta shared/, ver design.md D5).
//
// Módulo puro: sem GTK, roda no GJS e no Node (testes em linux/test/unit/scripts.test.js).

/** Junta as linhas de um script num só (igual ao `compact` do Swift). */
function compact(js) {
    return js.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
}

/** Converte texto em literal de string JavaScript (aspas e escapes corretos). */
export function jsString(text) {
    return JSON.stringify(String(text));
}

/** Lê título, artista, capa, posição e estado do player. */
export const STATE = compact(`
(function(){
  var v = document.querySelector('video');
  var ms = navigator.mediaSession;
  var m = ms ? ms.metadata : null;
  function txt(s){ var e = document.querySelector(s); return e ? (e.getAttribute('title') || e.textContent || '').trim() : ''; }
  var title = (m && m.title) || txt('ytmusic-player-bar .title');
  var artist = (m && m.artist) || '';
  if (!artist) { artist = txt('ytmusic-player-bar .byline').split('•')[0].trim(); }
  var album = (m && m.album) || '';
  var art = '';
  if (m && m.artwork && m.artwork.length) {
    var best = m.artwork[0], bestSize = 0;
    for (var i = 0; i < m.artwork.length; i++) {
      var a = m.artwork[i];
      var size = parseInt(String(a.sizes || '0').split('x')[0], 10) || 0;
      if (size >= bestSize) { best = a; bestSize = size; }
    }
    art = best.src || '';
  }
  if (!art) { var im = document.querySelector('ytmusic-player-bar img'); if (im) { art = im.src || ''; } }
  var lk = document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer');
  var liked = lk ? lk.getAttribute('like-status') === 'LIKE' : false;
  var cur = v ? v.currentTime : 0;
  var dur = v ? v.duration : 0;
  if (!isFinite(dur)) { dur = 0; }
  var playing = v ? (!v.paused && !v.ended) : false;
  var vs = document.querySelector('ytmusic-player-bar #volume-slider');
  var vol = vs ? Number(vs.value) : (v ? Math.round(v.volume * 100) : null);
  return JSON.stringify({title: title, artist: artist, album: album, art: art, cur: cur, dur: dur, playing: playing, liked: liked, vol: vol});
})()
`);

/**
 * Lê a fila "A seguir" (painel lateral do player do YouTube Music).
 * Ignora as cópias escondidas em #counterpart-renderer (versão vídeo/música da mesma faixa).
 */
export const QUEUE = compact(`
(function(){
  var nodes = document.querySelectorAll('ytmusic-player-queue-item');
  var out = [];
  function t(n, sel){ var e = n.querySelector(sel); return e ? (e.getAttribute('title') || e.textContent || '').trim() : ''; }
  for (var i = 0; i < nodes.length && out.length < 300; i++) {
    var n = nodes[i];
    if (n.closest('#counterpart-renderer')) { continue; }
    var title = t(n, '.song-title');
    if (!title) { continue; }
    var by = t(n, '.byline').split('\\u2022')[0].trim();
    var img = n.querySelector('.thumbnail img') || n.querySelector('img');
    var thumb = img ? (img.getAttribute('src') || '') : '';
    if (thumb.indexOf('data:') === 0) { thumb = ''; }
    var state = n.playButtonState || n.getAttribute('play-button-state') || '';
    var cur = n.selected === true || n.hasAttribute('selected') || state === 'playing' || state === 'paused';
    out.push({i: i, title: title, artist: by, dur: t(n, '.duration'), thumb: thumb, cur: cur});
  }
  return JSON.stringify(out);
})()
`);

/** Lê os resultados da página de busca (só linhas que tocam: músicas e vídeos). */
export const SEARCH_RESULTS = compact(`
(function(){
  var page = document.querySelector('ytmusic-search-page');
  var q = new URLSearchParams(location.search).get('q') || '';
  if (!page || location.pathname.indexOf('/search') !== 0) { return JSON.stringify({ready: false, q: q, items: []}); }
  var rows = page.querySelectorAll('ytmusic-responsive-list-item-renderer');
  var out = [];
  function t(n, sel){ var e = n.querySelector(sel); return e ? (e.getAttribute('title') || e.textContent || '').trim() : ''; }
  for (var i = 0; i < rows.length && out.length < 40; i++) {
    var n = rows[i];
    var a = n.querySelector('.title-column .title a[href*="watch?v="]') || n.querySelector('a[href*="watch?v="]');
    if (!a) { continue; }
    var m = (a.getAttribute('href') || '').match(/v=([^&]+)/);
    var sec = n.querySelectorAll('.secondary-flex-columns yt-formatted-string');
    var sub = '';
    for (var k = 0; k < sec.length; k++) { var s = (sec[k].getAttribute('title') || sec[k].textContent || '').trim(); if (s) { sub = s; break; } }
    var img = n.querySelector('img');
    var th = img ? (img.getAttribute('src') || '') : '';
    if (th.indexOf('data:') === 0) { th = ''; }
    out.push({i: i, id: m ? m[1] : '', title: t(n, '.title-column .title') || a.textContent.trim(), sub: sub, thumb: th});
  }
  return JSON.stringify({ready: rows.length > 0, q: q, items: out});
})()
`);

/** Pausa o vídeo diretamente (usado ao sair). */
export const PAUSE = "(function(){ var v = document.querySelector('video'); if (v) { v.pause(); } return 'ok'; })()";

const PLAY_PAUSE = compact(`
(function(){
  var b = document.querySelector('ytmusic-player-bar #play-pause-button');
  if (b) { b.click(); return 'ok'; }
  var v = document.querySelector('video');
  if (v) { if (v.paused) { v.play(); } else { v.pause(); } }
  return 'ok';
})()
`);

const NEXT = compact(`
(function(){
  var b = document.querySelector('ytmusic-player-bar .next-button button') || document.querySelector('ytmusic-player-bar .next-button');
  if (b) { b.click(); }
  return 'ok';
})()
`);

const PREVIOUS = compact(`
(function(){
  var b = document.querySelector('ytmusic-player-bar .previous-button button') || document.querySelector('ytmusic-player-bar .previous-button');
  if (b) { b.click(); }
  return 'ok';
})()
`);

const TOGGLE_LIKE = compact(`
(function(){
  var r = document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer');
  if (!r) { return 'ok'; }
  var b = r.querySelector('#button-shape-like button') || r.querySelector('.like');
  if (b) { b.click(); }
  return 'ok';
})()
`);

function clampInt(value, min, max) {
    const n = Math.round(Number(value));
    return Math.min(Math.max(Number.isFinite(n) ? n : min, min), max);
}

/**
 * JS de um comando. `command` é um objeto como {name: 'seek', seconds: 60}.
 * Nomes: playPause, next, previous, toggleLike, seek {seconds}, setVolume {value},
 * playQueueItem {index}, search {query}, playSearchResult {index, videoID}.
 */
export function jsFor(command) {
    switch (command.name) {
    case 'playPause':
        return PLAY_PAUSE;
    case 'next':
        return NEXT;
    case 'previous':
        return PREVIOUS;
    case 'toggleLike':
        return TOGGLE_LIKE;
    case 'setVolume': {
        const v = String(clampInt(command.value, 0, 100));
        return `(function(){ var v = ${v}; `
            + "var s = document.querySelector('ytmusic-player-bar #volume-slider'); "
            + "var p = document.querySelector('#movie_player'); "
            + "if (s) { s.value = v; s.dispatchEvent(new CustomEvent('change', {bubbles: true})); } "
            + 'else if (p && p.setVolume) { p.setVolume(v); } '
            + 'if (p && p.isMuted && p.isMuted() && v > 0) { p.unMute(); } '
            + "return 'ok'; })()";
    }
    case 'search':
        // Usa a caixa de busca do próprio YouTube Music: navega sem recarregar, a música não para.
        return `(function(){ var q = ${jsString(command.query)}; `
            + "var box = document.querySelector('ytmusic-search-box'); "
            + "var i = box && (box.querySelector('input#input') || box.querySelector('input')); "
            + "if (!i) { location.href = '/search?q=' + encodeURIComponent(q); return 'nav'; } "
            + "i.focus(); i.value = q; i.dispatchEvent(new Event('input', {bubbles: true})); "
            + "var o = {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true}; "
            + "i.dispatchEvent(new KeyboardEvent('keydown', o)); i.dispatchEvent(new KeyboardEvent('keypress', o)); "
            + "i.dispatchEvent(new KeyboardEvent('keyup', o)); i.blur(); return 'ok'; })()";
    case 'playSearchResult':
        return `(function(){ var vid = ${jsString(command.videoID)}; `
            + `var n = document.querySelectorAll('ytmusic-search-page ytmusic-responsive-list-item-renderer')[${clampInt(command.index, 0, 1e6)}]; `
            + "var a = n ? (n.querySelector('.title-column .title a[href*=\"watch?v=\"]') || n.querySelector('a[href*=\"watch?v=\"]')) : null; "
            + "if (a && (a.getAttribute('href') || '').indexOf(vid) >= 0) { a.click(); return 'ok'; } "
            + "location.href = '/watch?v=' + vid; return 'nav'; })()";
    case 'playQueueItem':
        return `(function(){ var n = document.querySelectorAll('ytmusic-player-queue-item')[${clampInt(command.index, 0, 1e6)}]; `
            + "if (!n) { return 'no'; } "
            + "var b = n.querySelector('.song-info') || n; "
            + "['mousedown', 'mouseup', 'click'].forEach(function(t){ "
            + 'b.dispatchEvent(new MouseEvent(t, {bubbles: true, cancelable: true, view: window})); }); '
            + "return 'ok'; })()";
    case 'seek': {
        const s = Math.max(0, Number(command.seconds) || 0).toFixed(2);
        return "(function(){ var p = document.querySelector('#movie_player'); "
            + `if (p && p.seekTo) { p.seekTo(${s}, true); return 'ok'; } `
            + `var v = document.querySelector('video'); if (v) { v.currentTime = ${s}; } return 'ok'; })()`;
    }
    default:
        throw new Error(`comando desconhecido: ${command.name}`);
    }
}

// MARK: - Parsers

function parseJSON(output) {
    try {
        return JSON.parse(output);
    } catch {
        return null;
    }
}

const str = v => (typeof v === 'string' ? v : '');
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Miniaturas da fila e da busca: pede um tamanho pequeno mas nítido. */
export function thumbnail(url) {
    if (typeof url !== 'string' || !url)
        return null;
    return url.replace(/=w\d+-h\d+/, '=w120-h120');
}

/** As capas do YouTube Music vêm como `...=w120-h120-...`; pedimos uma versão maior. */
export function largeArtwork(url) {
    if (typeof url !== 'string' || !url || url.startsWith('data:'))
        return null;
    return url.replace(/=w\d+-h\d+/, '=w800-h800');
}

/** Estado do player, ou null se a resposta não for o JSON esperado. */
export function parse(output) {
    const raw = parseJSON(output);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    return {
        title: str(raw.title),
        artist: str(raw.artist),
        album: str(raw.album),
        artworkURL: largeArtwork(raw.art),
        position: num(raw.cur),
        duration: num(raw.dur),
        isPlaying: raw.playing === true,
        liked: raw.liked === true,
        volume: typeof raw.vol === 'number' && Number.isFinite(raw.vol) ? raw.vol : null,
    };
}

/** Fila "A seguir"; resposta inválida vira lista vazia. */
export function parseQueue(output) {
    const raw = parseJSON(output);
    if (!Array.isArray(raw))
        return [];
    return raw.filter(item => item && Number.isInteger(item.i)).map(item => ({
        index: item.i,
        title: str(item.title),
        artist: str(item.artist),
        duration: str(item.dur),
        thumbnailURL: thumbnail(item.thumb),
        isCurrent: item.cur === true,
    }));
}

/** Duração em segundos a partir de "m:ss" ou "h:mm:ss". */
export function durationSeconds(text) {
    return String(text).split(':').reduce((acc, part) => acc * 60 + (parseInt(part, 10) || 0), 0);
}

/** Página de busca; resultados sem id de vídeo são descartados. */
export function parseSearch(output) {
    const raw = parseJSON(output);
    if (!raw || typeof raw !== 'object')
        return {ready: false, query: '', items: []};
    const items = (Array.isArray(raw.items) ? raw.items : [])
        .filter(item => item && Number.isInteger(item.i) && str(item.id))
        .map(item => ({
            index: item.i,
            videoID: item.id,
            title: str(item.title),
            subtitle: str(item.sub).split(' • ').join(' · '),
            thumbnailURL: thumbnail(item.thumb),
        }));
    return {ready: raw.ready === true, query: str(raw.q), items};
}
