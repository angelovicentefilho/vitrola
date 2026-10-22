// Desenha a árvore do menu.js como Gio.Menu + ações, para Gtk.PopoverMenu e Gtk.MenuButton.
// Itens sem ação aparecem desabilitados; marcados viram caixas de seleção; grupos viram rádio.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';
import Gtk from 'gi://Gtk?version=4.0';

const PREFIX = 'vm';

/**
 * Monta o modelo e as ações. `activate(id)` é chamado com o id do item escolhido.
 * @returns {{model: Gio.Menu, actions: Gio.SimpleActionGroup}}
 */
export function buildMenuModel(tree, activate) {
    const actions = new Gio.SimpleActionGroup();
    let counter = 0;

    const plain = new Gio.SimpleAction({name: 'item', parameter_type: new GLib.VariantType('s')});
    plain.connect('activate', (_a, param) => activate(param.unpack()));
    actions.add_action(plain);

    function addItem(menu, entry) {
        const menuItem = new Gio.MenuItem();
        menuItem.set_label(entry.label);
        if (entry.enabled) {
            if (entry.checked !== undefined && !entry.radio) {
                const name = `check-${counter++}`;
                const action = new Gio.SimpleAction({name, state: new GLib.Variant('b', entry.checked)});
                action.connect('activate', () => activate(entry.id));
                actions.add_action(action);
                menuItem.set_detailed_action(`${PREFIX}.${name}`);
            } else {
                menuItem.set_action_and_target_value(`${PREFIX}.item`, new GLib.Variant('s', entry.id));
            }
        }
        menu.append_item(menuItem);
    }

    function addRadioGroup(menu, entry) {
        const name = `radio-${counter++}`;
        const checked = entry.children.find(c => c.checked)?.id ?? '';
        const action = new Gio.SimpleAction({
            name,
            parameter_type: new GLib.VariantType('s'),
            state: new GLib.Variant('s', checked),
        });
        action.connect('activate', (_a, param) => activate(param.unpack()));
        actions.add_action(action);

        const submenu = new Gio.Menu();
        for (const child of entry.children) {
            const menuItem = Gio.MenuItem.new(child.label, null);
            if (child.enabled)
                menuItem.set_action_and_target_value(`${PREFIX}.${name}`, new GLib.Variant('s', child.id));
            submenu.append_item(menuItem);
        }
        menu.append_submenu(entry.label, submenu);
    }

    // Separadores do menu.js viram seções do Gio.Menu.
    const model = new Gio.Menu();
    let section = new Gio.Menu();
    for (const entry of tree) {
        if (entry.separator) {
            model.append_section(null, section);
            section = new Gio.Menu();
        } else if (entry.children) {
            addRadioGroup(section, entry);
        } else {
            addItem(section, entry);
        }
    }
    model.append_section(null, section);
    return {model, actions};
}

/**
 * Popover de menu ligado a um widget, que se remonta a cada abertura.
 * @param {Gtk.Widget} parent
 * @param {{menu(): object[], refreshMenu(): Promise<object[]>, activate(id): void}} source
 */
export class VitrolaPopover {
    constructor(parent, source) {
        this._parent = parent;
        this._source = source;
        this.popover = new Gtk.PopoverMenu({has_arrow: true});
        this.popover.set_parent(parent);
    }

    /** Remonta com o estado atual e, quando as saídas de áudio forem relidas, de novo. */
    rebuild() {
        this._apply(this._source.menu());
        this._source.refreshMenu().then(tree => {
            if (this.popover.visible)
                this._apply(tree);
        }).catch(() => {});
    }

    _apply(tree) {
        const {model, actions} = buildMenuModel(tree, id => this._source.activate(id));
        this._parent.insert_action_group(PREFIX, actions);
        this.popover.set_menu_model(model);
    }

    /** Abre no ponto (x, y) do widget pai, ou centralizado se não houver ponto. */
    popupAt(x = null, y = null) {
        this.rebuild();
        if (x !== null && y !== null) {
            const rect = new Gdk.Rectangle({x: Math.round(x), y: Math.round(y), width: 1, height: 1});
            this.popover.set_pointing_to(rect);
        }
        this.popover.popup();
    }
}

/** Botão de menu (☰) para barras de título. */
export function menuButton(source) {
    const button = new Gtk.MenuButton({icon_name: 'open-menu-symbolic', tooltip_text: 'Menu da Vitrola'});
    const popover = new Gtk.PopoverMenu();
    button.set_popover(popover);
    button.set_create_popup_func(() => {
        const apply = tree => {
            const {model, actions} = buildMenuModel(tree, id => source.activate(id));
            button.insert_action_group(PREFIX, actions);
            popover.set_menu_model(model);
        };
        apply(source.menu());
        source.refreshMenu().then(tree => {
            if (popover.visible)
                apply(tree);
        }).catch(() => {});
    });
    return button;
}
