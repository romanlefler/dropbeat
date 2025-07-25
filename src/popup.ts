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

import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import St from "gi://St";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { ExtensionMetadata } from "resource:///org/gnome/shell/extensions/extension.js";
import { PlayerInfo } from "./mpris.js";
import { gettext as _g } from "./gettext.js";
import { getStandardCover, getBlurredCover, BannedImageFormatError } from "./imgprocessing.js";

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

    #metadata : ExtensionMetadata;
    #coverUri : string | null = null;

    #menuItem : PopupMenu.PopupBaseMenuItem;
    #menuBox : St.BoxLayout;

    #coverBin : St.Widget;
    #coverImg : St.Widget;
    #title : St.Label;

    constructor(menu : PopupMenu.PopupMenu, metadata : ExtensionMetadata) {
        this.#metadata = metadata;

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
        this.#coverImg = new St.Widget({
            style_class: "dropbeat-text dropbeat-cover",
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL
        });
        this.#coverBin = new St.Bin({
            child: this.#coverImg
        });

        // This forces it to be a square
        this.#coverImg.connect("notify::allocation", () => {
            const width = this.#coverBin.allocation.get_width();
            this.#coverBin.set_size(width, width);
        });

        this.#title = new St.Label({
            style_class: "dropbeat-title",
            text: _g("No Title")
        });
        box.add_child(vSpacer(0));
        box.add_child(this.#coverBin);
        box.add_child(vSpacer(20));
        box.add_child(this.#title);

        this.#menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.#menuItem.actor.add_child(box);

        menu.addMenuItem(this.#menuItem);
        
        menu.box.set_size(w, h);
        menu.box.add_style_class_name("dropbeat-menu");
        this.#menuBox = menu.box;
    }

    free() {
        this.#menuItem.destroy();
    }

    updateGui(p : PlayerInfo) : void {
        this.updateGuiAsync(p).catch(e => console.error(e));
    }

    async updateGuiAsync(p : PlayerInfo) : Promise<void> {
        this.#title.text = p.title || _g("No Title");

        let uri : string;
        if(p.artUrl) uri = p.artUrl;
        else uri = this.#metadata.path + "/music.png";

        if(this.#coverUri !== uri && uri) {
            let art : string, blurred : string;
            try {
                art = await getStandardCover(uri);
                blurred = await getBlurredCover(art);
            } catch(e) {
                if(e instanceof Gio.ResolverError || e instanceof BannedImageFormatError) {
                    console.warn(`Failed to process cover art "${uri}": ${e.message}`);
                    art = await getStandardCover(`file://${this.#metadata.path}/music.png`);
                    blurred = await getBlurredCover(art);
                } else throw e;
            }
            this.#coverImg.style = `background-image: url('${art}');`;
            this.#menuBox.style = `background-image: url('${blurred}');`;
        }
        this.#coverUri = uri;
    }

}

