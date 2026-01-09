/*
    Copyright 2025 Roman Lefler

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import { gettext as _g } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { ShortcutRow } from "./shortcutrow.js";

function setVisibilites(value : boolean, ...widgets : Gtk.Widget[]) {
    for(let w of widgets) w.visible = value;
}

export class GeneralPage extends Adw.PreferencesPage {

    static {
        GObject.registerClass(this);
    }

    constructor(settings : Gio.Settings) {

        super({
            title: _g("General"),
            icon_name: "preferences-system-symbolic"
        });

        const keybindingsGroup = new Adw.PreferencesGroup({
            title: _g("Keybindings"),
            description: _g("Configure keyboard shortcuts")
        });
        const openMenuShortcut = new ShortcutRow({
            title: _g("Desktop Shortcut"),
            subtitle: _g("Desktop keyboard shortcut to open/close the card"),
            value: settings.get_strv("open-menu-keybinding")[0] || null
        });
        openMenuShortcut.addValueChangedListener((v : string | null) => {
            openMenuSuper.active = openMenuShortcut.getSuper();

            settings.set_strv("open-menu-keybinding", v ? [ v ] : [ ]);
            settings.apply();
        });

        const openMenuSuper = new Adw.SwitchRow({
            title: _g("Include Super Key?"),
            subtitle: _g("Insert Super key into above shortcut"),
            active: openMenuShortcut.getSuper()
        });
        openMenuSuper.connect("notify::active", (w : Adw.SwitchRow) => {
            openMenuShortcut.setSuper(w.active);
        });

        keybindingsGroup.add(openMenuShortcut);
        keybindingsGroup.add(openMenuSuper);

        const internetGroup = new Adw.PreferencesGroup({
            title: _g("Internet"),
            description: _g("Configure Internet permissions")
        })
        const useInternet = new Adw.SwitchRow({
            title: _g("Fetch Album Covers"),
            subtitle: _g("Allow fetching album covers over HTTP/HTTPS"),
            active: settings.get_boolean("album-cover-internet")
        });
        useInternet.connect("notify::active", (w : Adw.SwitchRow) => {
            settings.set_boolean("album-cover-internet", w.active);
            settings.apply();
        });

        internetGroup.add(useInternet);

        this.add(keybindingsGroup);
        this.add(internetGroup);
    }

}
