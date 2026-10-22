// Interface D-Bus privada da Vitrola (design.md D6): o que o MPRIS não cobre e a extensão do
// GNOME Shell precisa — estado detalhado, preferências, menu, curtir, abrir busca e playlist.
// Os payloads ricos trafegam como JSON em strings.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {log} from './log.js';

export const BUS_NAME = 'io.github.vitrola.Vitrola';
export const OBJECT_PATH = '/io/github/vitrola/Vitrola';

const XML = `
<node>
  <interface name="io.github.vitrola.Vitrola">
    <method name="GetState"><arg direction="out" type="s"/></method>
    <method name="GetPrefs"><arg direction="out" type="s"/></method>
    <method name="GetMenu"><arg direction="out" type="s"/></method>
    <method name="ActivateMenuItem"><arg direction="in" name="id" type="s"/></method>
    <method name="Command">
      <arg direction="in" name="json" type="s"/>
      <arg direction="out" name="ok" type="b"/>
    </method>
    <method name="ShowSearch"/>
    <method name="ShowPlaylist"/>
    <signal name="StateChanged"><arg name="json" type="s"/></signal>
    <signal name="PrefsChanged"><arg name="json" type="s"/></signal>
  </interface>
</node>`;

/**
 * @param {object} controller o objeto Vitrola (app.js): stateJSON(), prefsJSON(), menuJSON() async,
 *   activate(id), command(json) → bool, showSearch(), showPlaylist()
 */
export class VitrolaService {
    constructor(connection, controller) {
        this._controller = controller;
        this._exported = Gio.DBusExportedObject.wrapJSObject(XML, this);
        this._exported.export(connection, OBJECT_PATH);
        log(`interface privada em ${OBJECT_PATH}`);
    }

    GetState() {
        return this._controller.stateJSON();
    }

    GetPrefs() {
        return this._controller.prefsJSON();
    }

    /** Assíncrono: relê as saídas de áudio antes de montar o menu. */
    GetMenuAsync(_params, invocation) {
        this._controller.menuJSON()
            .then(json => invocation.return_value(new GLib.Variant('(s)', [json])))
            .catch(e => invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED, e.message));
    }

    ActivateMenuItem(id) {
        this._controller.activate(id);
    }

    Command(json) {
        return this._controller.command(json);
    }

    ShowSearch() {
        this._controller.showSearch();
    }

    ShowPlaylist() {
        this._controller.showPlaylist();
    }

    emitState(json) {
        this._exported.emit_signal('StateChanged', new GLib.Variant('(s)', [json]));
    }

    emitPrefs(json) {
        this._exported.emit_signal('PrefsChanged', new GLib.Variant('(s)', [json]));
    }

    destroy() {
        this._exported.unexport();
    }
}
