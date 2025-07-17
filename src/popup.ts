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
import { PlayerInfo } from "./mpris.js";
import { gettext as _g } from "./gettext.js";

function getScreenSize() : { w : number, h : number} {
    const monitor = Main.layoutManager.primaryMonitor;
    return {
        w: monitor?.width ?? 1920,
        h: monitor?.height ?? 1080
    };
}

function vSpacer(px : number) {
    return new St.Bin({ height: px, margin_top: 0, margin_bottom: 0 });
}

export class Popup {

    #menuItem : PopupMenu.PopupBaseMenuItem;

    #cover : St.Widget;
    #title : St.Label;

    constructor(menu : PopupMenu.PopupMenu) {
        const { w: screenW, h: screenH } = getScreenSize();
        const szMin = Math.min(screenW, screenH);
        // 3:2 aspect ratio
        const w = szMin * 0.5 / 1.5;
        const h = szMin * 0.5;

        const box = new St.BoxLayout({
            style_class: "dropbeat-card",
            vertical: true,
            x_expand: true,
            y_expand: true
        });
        this.#cover = new St.Widget({
            style_class: "dropbeat-cover",
            width: w * 0.8,
            height: w * 0.8
        });
        this.#title = new St.Label({
            style_class: "dropbeat-title",
            text: _g("No Title")
        });
        box.add_child(vSpacer(0));
        box.add_child(this.#cover);
        box.add_child(vSpacer(20));
        box.add_child(this.#title);

        this.#menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.#menuItem.actor.add_child(box);

        menu.addMenuItem(this.#menuItem);
        
        menu.box.set_size(w, h);
        menu.box.add_style_class_name("dropbeat-menu");
    }

    free() {
        this.#menuItem.destroy();
    }

    updateGui(p : PlayerInfo) : void {
        this.#title.text = p.title || _g("No Title");
        this.#cover.style = `background-image: url("${p.artUrl}");`;
    }

}

