// A vitrola flutuante: janela sem bordas e transparente com o disco girando e os controles.
// "Sempre na frente" e a posição lembrada ficam com a extensão do GNOME Shell (design.md D8),
// que acha esta janela pelo id do app + FLOATING_TITLE.

import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Gtk from 'gi://Gtk?version=4.0';

import {log} from './log.js';
import {VitrolaPopover} from './menu-view.js';
import {DISC_DIAMETER} from './prefs.js';
import {drawTurntable, paintDefaultLabel} from './vinyl-draw.js';
import * as G from './vinyl-geometry.js';

export const FLOATING_TITLE = 'Vitrola — vitrola flutuante';
const HUD_MS = 1100;

const BASE_CSS = `
window.vitrola-floating, window.vitrola-floating > contents { background: transparent; box-shadow: none; }
.vitrola-card { color: white; }
.vitrola-card label, .vitrola-hover label, .vitrola-pill { color: white; }
.vitrola-hover { background-color: rgba(0,0,0,0.62); border-radius: 16px; padding: 8px 12px; }
.vitrola-pill { background-color: rgba(0,0,0,0.7); border-radius: 999px; padding: 6px 12px; font-weight: bold; }
.vitrola-flat button, button.vitrola-flat { background: none; border: none; box-shadow: none; color: white;
    min-width: 0; min-height: 0; padding: 3px; }
.vitrola-flat button:hover, button.vitrola-flat:hover { background-color: rgba(255,255,255,0.12); }
.vitrola-liked { color: #ff4d6d; }
.vitrola-dim { opacity: 0.75; }
.vitrola-dimmer { opacity: 0.55; }
.vitrola-volume trough { min-width: 4px; background-color: rgba(255,255,255,0.22); }
.vitrola-volume highlight { background-color: white; }
.vitrola-volume slider { min-width: 10px; min-height: 10px; margin: -4px; background-color: white; }
`;

let baseProviderInstalled = false;

function installBaseCss() {
    if (baseProviderInstalled)
        return;
    const provider = new Gtk.CssProvider();
    provider.load_from_string(BASE_CSS);
    Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    baseProviderInstalled = true;
}

function iconButton(icon, tooltip, onClick, pixelSize = 16) {
    const button = new Gtk.Button({tooltip_text: tooltip, css_classes: ['vitrola-flat']});
    const image = new Gtk.Image({icon_name: icon, pixel_size: pixelSize});
    button.set_child(image);
    button.connect('clicked', onClick);
    button.image = image;
    return button;
}

/** Capa recortada em quadrado e redimensionada para o selo. */
function squareCover(pixbuf, size) {
    const side = Math.min(pixbuf.get_width(), pixbuf.get_height());
    const x = Math.floor((pixbuf.get_width() - side) / 2);
    const y = Math.floor((pixbuf.get_height() - side) / 2);
    return pixbuf.new_subpixbuf(x, y, side, side).scale_simple(size, size, GdkPixbuf.InterpType.BILINEAR);
}

function averageColor(pixbuf) {
    const pixels = pixbuf.scale_simple(1, 1, GdkPixbuf.InterpType.BILINEAR).get_pixels();
    return [pixels[0], pixels[1], pixels[2]];
}

export class FloatingVinyl {
    /** @param {import('./app.js').Vitrola} vitrola */
    constructor(vitrola) {
        this._vitrola = vitrola;
        this._model = vitrola.model;
        this._prefs = vitrola.prefs;
        this._hovering = false;
        this._art = {url: null, pixbuf: null, label: null, labelSize: 0, color: G.DEFAULT_CARD};
        this._armShown = G.ARM.rest;
        this._tickId = 0;
        this._hudTimeout = 0;
        this._syncingVolume = false;

        installBaseCss();
        this._dynamicCss = new Gtk.CssProvider();
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), this._dynamicCss,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 1);

        this.window = new Gtk.Window({
            application: vitrola.app,
            title: FLOATING_TITLE,
            decorated: false,
            resizable: false,
            css_classes: ['vitrola-floating'],
        });
        // Fechar (Alt+F4) só desliga a opção.
        this.window.connect('close-request', () => {
            this._prefs.set('showFloating', false);
            return true;
        });

        this._modelHandler = this._model.connect(() => this._update());
        this._prefsHandler = this._prefs.connect(key => this._onPref(key));
        this._build();
        this._setVisible(this._prefs.get('showFloating'));
    }

    _onPref(key) {
        if (key === 'showFloating')
            this._setVisible(this._prefs.get('showFloating'));
        else if (['layout', 'size', 'showTonearm', 'showProgress', 'albumColorBackground'].includes(key))
            this._build();
    }

    _setVisible(visible) {
        if (visible) {
            this.window.present();
            log('vitrola flutuante visível');
        } else {
            this.window.set_visible(false);
        }
    }

    // MARK: - Montagem

    _build() {
        this._stopAnimating();
        const d = DISC_DIAMETER[this._prefs.get('size')];
        const layout = this._prefs.get('layout');
        this._m = G.floatingMetrics(d, layout);
        const m = this._m;

        this._area = new Gtk.DrawingArea({content_width: Math.round(m.turntableWidth), content_height: d});
        this._area.set_draw_func((_a, cr) => this._draw(cr));

        this._hud = new Gtk.Label({css_classes: ['vitrola-pill'], halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER, visible: false});
        this._statusPill = new Gtk.Label({css_classes: ['vitrola-pill'], wrap: true, justify: Gtk.Justification.CENTER,
            max_width_chars: 22, halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER, visible: false});

        const discOverlay = new Gtk.Overlay({child: this._area});
        // O HUD, a pílula e os controles ficam centralizados sobre o disco (não sobre o braço).
        const overDisc = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, width_request: d, height_request: d,
            halign: Gtk.Align.START, valign: Gtk.Align.START, can_target: true});
        const center = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, vexpand: true, valign: Gtk.Align.CENTER,
            halign: Gtk.Align.CENTER, spacing: 4});
        center.append(this._hud);
        overDisc.append(center);
        discOverlay.add_overlay(overDisc);

        if (layout === 'disc')
            this._buildDiscLayout(discOverlay, center);
        else
            this._buildCardLayout(discOverlay, center);

        this._applyDynamicCss();
        this._update();
    }

    _transport(scale) {
        const box = new Gtk.Box({spacing: Math.round(6 * scale), css_classes: ['vitrola-flat'], halign: Gtk.Align.CENTER});
        box.append(iconButton('media-skip-backward-symbolic', 'Faixa anterior', () => this._model.previous(), Math.round(15 * scale)));
        this._playButton = iconButton('media-playback-start-symbolic', 'Tocar / Pausar', () => this._model.playPause(), Math.round(22 * scale));
        box.append(this._playButton);
        box.append(iconButton('media-skip-forward-symbolic', 'Próxima faixa', () => this._model.next(), Math.round(15 * scale)));
        return box;
    }

    _buildDiscLayout(discOverlay, center) {
        const m = this._m;
        const s = Math.max(m.scale, 0.8) * 0.85;
        this._hoverBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, css_classes: ['vitrola-hover'],
            visible: false, width_request: Math.round(m.d * 0.6)});
        this._nowPlaying = new Gtk.Label({ellipsize: Pango.EllipsizeMode.END, max_width_chars: 24, css_classes: ['vitrola-now']});
        this._hoverBox.append(this._nowPlaying);
        this._hoverBox.append(this._transport(s));
        center.append(this._hoverBox);
        center.append(this._statusPill);

        this._volumeColumn = null;
        this._progress = null;
        this._titleLabel = null;
        this._root = new Gtk.Box({margin_top: m.pad, margin_bottom: m.pad, margin_start: m.pad, margin_end: m.pad});
        this._root.append(discOverlay);
        this._attachControllers(this._root);
        this.window.set_child(this._root);
    }

    _buildCardLayout(discOverlay, center) {
        const m = this._m;
        const s = m.scale;
        this._hoverBox = null;
        this._nowPlaying = null;
        center.append(new Gtk.Box());     // mantém o HUD centralizado

        const card = new Gtk.Box({spacing: m.gap, css_classes: ['vitrola-card']});
        card.append(discOverlay);

        // Barrinha de volume: só aparece com o ponteiro em cima ou durante a rolagem.
        this._volumeColumn = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6, width_request: m.volumeWidth,
            valign: Gtk.Align.CENTER, opacity: 0});
        this._volumeScale = new Gtk.Scale({orientation: Gtk.Orientation.VERTICAL, inverted: true, draw_value: false,
            height_request: Math.round(m.d * 0.8), css_classes: ['vitrola-volume'], halign: Gtk.Align.CENTER,
            adjustment: new Gtk.Adjustment({lower: 0, upper: 100, step_increment: 5, page_increment: 10})});
        this._volumeScale.connect('value-changed', scale => {
            if (!this._syncingVolume)
                this._model.setVolume(scale.get_value());
        });
        this._muteButton = iconButton('audio-volume-high-symbolic', 'Silenciar', () => this._model.toggleMute(), 12);
        this._volumeColumn.append(this._volumeScale);
        this._volumeColumn.append(this._muteButton);
        card.append(this._volumeColumn);

        const text = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: Math.round(4 * s),
            width_request: Math.round(m.textWidth), height_request: m.d});
        this._titleLabel = new Gtk.Label({xalign: 0, wrap: true, lines: 2, ellipsize: Pango.EllipsizeMode.END, css_classes: ['vitrola-title'],
            max_width_chars: 1, hexpand: true});
        this._artistLabel = new Gtk.Label({xalign: 0, ellipsize: Pango.EllipsizeMode.END, css_classes: ['vitrola-artist', 'vitrola-dim'], max_width_chars: 1});
        this._albumLabel = new Gtk.Label({xalign: 0, ellipsize: Pango.EllipsizeMode.END, css_classes: ['vitrola-artist', 'vitrola-dimmer'], max_width_chars: 1});
        text.append(this._titleLabel);
        text.append(this._artistLabel);
        text.append(this._albumLabel);
        text.append(new Gtk.Box({vexpand: true}));

        this._statusPill.set_halign(Gtk.Align.START);
        text.append(this._statusPill);
        this._progressBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 2,
            visible: this._prefs.get('showProgress')});
        this._progress = new Gtk.DrawingArea({content_height: 10, hexpand: true});
        this._progress.set_draw_func((_a, cr, w, h) => this._drawProgress(cr, w, h));
        const seek = new Gtk.GestureClick({button: 1});
        seek.connect('pressed', (gesture, _n, x) => {
            gesture.set_state(Gtk.EventSequenceState.CLAIMED);
            const width = this._progress.get_width();
            if (width > 0)
                this._vitrola.command(JSON.stringify({name: 'seekFraction', fraction: Math.min(Math.max(x / width, 0), 1)}));
        });
        this._progress.add_controller(seek);
        const times = new Gtk.Box();
        this._elapsed = new Gtk.Label({xalign: 0, hexpand: true, css_classes: ['vitrola-time', 'vitrola-dim']});
        this._total = new Gtk.Label({xalign: 1, css_classes: ['vitrola-time', 'vitrola-dim']});
        times.append(this._elapsed);
        times.append(this._total);
        this._progressBox.append(this._progress);
        this._progressBox.append(times);
        text.append(this._progressBox);

        const controls = new Gtk.Box({css_classes: ['vitrola-flat']});
        controls.append(this._transport(s));
        controls.append(new Gtk.Box({hexpand: true}));
        this._likeButton = iconButton('emblem-favorite-symbolic', 'Curtir no YouTube Music', () => this._model.toggleLike(), Math.round(14 * s));
        controls.append(this._likeButton);
        controls.append(iconButton('view-list-symbolic', 'Playlist (A seguir)', () => this._prefs.toggle('showPlaylist'), Math.round(14 * s)));
        controls.append(iconButton('view-more-symbolic', 'Menu da Vitrola (ou clique direito)', () => this._menu().popupAt(), Math.round(14 * s)));
        text.append(controls);
        card.append(text);

        this._root = new Gtk.Box({margin_top: m.pad, margin_bottom: m.pad, margin_start: m.pad, margin_end: m.pad});
        this._root.append(card);
        this._attachControllers(this._root);
        this.window.set_child(this._root);
    }

    _applyDynamicCss() {
        const m = this._m;
        const s = m.scale;
        const [r, g, b] = this._prefs.get('albumColorBackground') ? G.cardBackground(this._art.color) : G.DEFAULT_CARD;
        this._dynamicCss.load_from_string(`
            .vitrola-card { background-color: rgb(${r},${g},${b}); border-radius: ${Math.round(22 * s)}px;
                padding: ${m.inner}px; box-shadow: 0 6px 10px rgba(0,0,0,0.35); }
            .vitrola-title { font-weight: bold; font-size: ${(15 * s).toFixed(1)}px; }
            .vitrola-artist { font-size: ${(12 * s).toFixed(1)}px; }
            .vitrola-time { font-size: ${(10 * s).toFixed(1)}px; font-feature-settings: "tnum"; }
            .vitrola-now { font-weight: bold; font-size: ${(11 * Math.max(s, 0.85)).toFixed(1)}px; }
        `);
    }

    // MARK: - Interação

    _menu() {
        if (!this._popover || this._popoverParent !== this._root) {
            this._popover?.popover.unparent();
            this._popover = new VitrolaPopover(this._root, this._vitrola);
            this._popoverParent = this._root;
        }
        return this._popover;
    }

    _attachControllers(widget) {
        // Arrastar com o botão esquerdo move a janela (funciona em Wayland e X11).
        const drag = new Gtk.GestureClick({button: 1});
        drag.connect('pressed', (gesture, _n, x, y) => {
            const surface = this.window.get_surface();
            const [ok, wx, wy] = widget.translate_coordinates(this.window, x, y);
            if (surface && ok)
                surface.begin_move(gesture.get_device(), 1, wx, wy, gesture.get_current_event_time());
        });
        widget.add_controller(drag);

        const context = new Gtk.GestureClick({button: 3});
        context.connect('pressed', (_g, _n, x, y) => this._menu().popupAt(x, y));
        widget.add_controller(context);

        const motion = new Gtk.EventControllerMotion();
        motion.connect('enter', () => this._setHovering(true));
        motion.connect('leave', () => this._setHovering(false));
        widget.add_controller(motion);

        const scroll = new Gtk.EventControllerScroll({flags: Gtk.EventControllerScrollFlags.VERTICAL});
        scroll.connect('scroll', (controller, _dx, dy) => {
            const wheel = controller.get_unit() === Gdk.ScrollUnit.WHEEL;
            this._model.adjustVolume(G.scrollVolumeDelta(dy, wheel));
            return true;
        });
        widget.add_controller(scroll);
    }

    _setHovering(hovering) {
        this._hovering = hovering;
        this._update();
    }

    // MARK: - Atualização

    _update() {
        const model = this._model;
        const track = model.track;
        const message = track ? null : model.message;
        const now = Date.now();
        const hudVisible = now - model.volumeChangedAt < HUD_MS;

        this._loadArt(track?.artworkURL ?? null);

        this._playButton.image.set_from_icon_name(model.isPlaying ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic');
        this._statusPill.set_label(message ?? '');
        this._statusPill.set_visible(Boolean(message));
        this._hud.set_label(`${Math.round(model.volume)}%`);
        this._hud.set_visible(hudVisible);
        if (hudVisible)
            this._scheduleHudHide(model.volumeChangedAt + HUD_MS - now);

        if (this._hoverBox) {
            this._hoverBox.set_visible(this._hovering && !message);
            this._nowPlaying.set_label(track ? (track.artist ? `${track.title} — ${track.artist}` : track.title) : 'YouTube Music');
        }
        if (this._titleLabel) {
            this._titleLabel.set_label(track?.title ?? 'Vitrola');
            this._artistLabel.set_label(track?.artist ?? 'YouTube Music');
            this._albumLabel.set_label(track?.album ?? '');
            this._albumLabel.set_visible(Boolean(track?.album));
            this._progressBox.set_visible(this._prefs.get('showProgress') && !message);
            this._elapsed.set_label(G.formatTime(model.position()));
            this._total.set_label(track?.duration ? G.formatTime(track.duration) : '');
            this._progress.queue_draw();
            const liked = track?.liked ?? false;
            if (liked)
                this._likeButton.add_css_class('vitrola-liked');
            else
                this._likeButton.remove_css_class('vitrola-liked');
            this._volumeColumn.set_opacity(this._hovering || hudVisible ? 1 : 0);
            this._volumeColumn.set_can_target(this._hovering || hudVisible);
            this._syncingVolume = true;
            this._volumeScale.set_value(model.volume);
            this._syncingVolume = false;
            this._muteButton.image.set_from_icon_name(G.volumeIcon(model.volume));
        }

        if (this._shouldAnimate())
            this._startAnimating();
        this._area.queue_draw();
    }

    _scheduleHudHide(ms) {
        if (this._hudTimeout)
            GLib.source_remove(this._hudTimeout);
        this._hudTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(50, ms), () => {
            this._hudTimeout = 0;
            this._update();
            return GLib.SOURCE_REMOVE;
        });
    }

    /** Toca ou o braço ainda está a caminho: precisa redesenhar a cada quadro. */
    _shouldAnimate() {
        const armMoving = Math.abs((this._armTarget ?? this._armShown) - this._armShown) > 0.05;
        return this.window.visible && (this._model.isPlaying || armMoving);
    }

    /** Redesenha a cada quadro só enquanto precisa (o disco parado não gasta CPU). */
    _startAnimating() {
        if (this._tickId)
            return;
        this._tickId = this._area.add_tick_callback(() => {
            this._area.queue_draw();
            if (this._shouldAnimate())
                return GLib.SOURCE_CONTINUE;
            this._tickId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopAnimating() {
        if (this._tickId)
            this._area.remove_tick_callback(this._tickId);
        this._tickId = 0;
    }

    _loadArt(url) {
        if (url === this._art.url)
            return;
        this._art = {url, pixbuf: null, label: null, labelSize: 0, color: G.DEFAULT_CARD};
        this._applyDynamicCss();
        if (!url)
            return;
        this._vitrola.images.fetch(url).then(path => {
            if (!path || url !== this._art.url)
                return;
            try {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
                this._art.pixbuf = pixbuf;
                this._art.color = averageColor(pixbuf);
                this._applyDynamicCss();
                this._area.queue_draw();
            } catch (e) {
                log(`capa ilegível: ${e.message}`);
            }
        });
    }

    // MARK: - Desenho

    _paintLabel(cr, cx, cy, r) {
        const {pixbuf} = this._art;
        if (!pixbuf) {
            paintDefaultLabel(cr, cx, cy, r);
            return;
        }
        const size = Math.ceil(r * 2);
        if (this._art.labelSize !== size) {
            this._art.label = squareCover(pixbuf, size);
            this._art.labelSize = size;
        }
        Gdk.cairo_set_source_pixbuf(cr, this._art.label, cx - r, cy - r);
        cr.paint();
    }

    _draw(cr) {
        const d = this._m.d;
        const target = G.armAngle(this._model.track ? {...this._model.track, position: this._model.position()} : null);
        // O braço anda devagar até o ângulo novo, como a animação de 0,9 s do Mac.
        this._armTarget = target;
        this._armShown += (target - this._armShown) * 0.08;
        if (this._shouldAnimate())
            this._startAnimating();
        drawTurntable(cr, 0, 0, d, {
            angle: this._model.spin.angle(),
            armAngle: this._armShown,
            showArm: this._prefs.get('showTonearm'),
            paintLabel: (c, cx, cy, r) => this._paintLabel(c, cx, cy, r),
        });
    }

    _drawProgress(cr, width, height) {
        const track = this._model.track;
        const fraction = track?.duration ? Math.min(this._model.position() / track.duration, 1) : 0;
        const y = height / 2 - 2;
        cr.setSourceRGBA(1, 1, 1, 0.22);
        cr.rectangle(0, y, width, 4);
        cr.fill();
        cr.setSourceRGBA(1, 1, 1, 1);
        cr.rectangle(0, y, width * fraction, 4);
        cr.fill();
    }

    destroy() {
        this._stopAnimating();
        this._model.disconnect(this._modelHandler);
        this._prefs.disconnect(this._prefsHandler);
        this.window.destroy();
    }
}
