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

import Gio from "gi://Gio";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as extensionGettext } from "resource:///org/gnome/shell/extensions/extension.js";
import { setUpGettext } from "./gettext.js";

export default class DropbeatExtension extends Extension {

    #gsettings? : Gio.Settings;
    #indicator? : PanelMenu.Button;
    #panelIcon? : St.Icon;

    /**
     * Called by GNOME Extensions when this extension is enabled.
     * This is the entry point.
     */
    enable() : void {
        setUpGettext(extensionGettext);
        this.#gsettings = this.getSettings();
        this.#createIndicator();
    }

    /**
     * Called by GNOME Extensions when this extension is disabled.
     */
    disable() : void {
        this.#panelIcon = undefined;
        this.#indicator?.destroy();
        this.#indicator = undefined;

        this.#gsettings = undefined;
    }

    #createIndicator() : void {
        const indic = new PanelMenu.Button(0, "Weather", false);
        const layout = new St.BoxLayout({
            vertical: false
        });

        this.#panelIcon = new St.Icon({
            icon_name: "view-refresh-symbolic",
            style_class: "system-status-icon"
        });

        layout.add_child(this.#panelIcon);
        indic.add_child(layout);

        this.#indicator?.destroy();
        this.#indicator = indic;
        Main.panel.addToStatusArea(this.uuid, this.#indicator!, 0, "right");
    }

}
