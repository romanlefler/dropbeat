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

import St from "gi://St";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

function getScreenSize() : { w : number, h : number} {
    const monitor = Main.layoutManager.primaryMonitor;
    return {
        w: monitor?.width ?? 1920,
        h: monitor?.height ?? 1080
    };
}

export class Popup {

    #menuItem : PopupMenu.PopupBaseMenuItem;

    #cover : St.Widget;
    #title : St.Label;

    constructor(menu : PopupMenu.PopupMenu) {
        const box = new St.BoxLayout({ vertical: true, style_class: "dropbeat-card" });
        this.#cover = new St.Widget({ style_class: "dropbeat-cover" });
        this.#title = new St.Label({ text: "Title" });
        box.add_child(this.#cover);
        box.add_child(this.#title);

        const { w, h } = getScreenSize();
        const szMin = Math.min(w, h);

        this.#menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.#menuItem.actor.add_child(box);

        menu.addMenuItem(this.#menuItem);
        // 3:2 aspect ratio
        menu.box.set_size(szMin * 0.5 * 1.5, szMin * 0.5);
        menu.box.add_style_class_name("dropbeat-menu");
    }

    free() {
        this.#menuItem.destroy();
    }

}

