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
import Meta from "gi://Meta";
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

// Widget must have reactive and track_hover true
function setPointer(widget : Clutter.Actor) : void {
    if(Meta.Cursor.POINTER && Meta.Cursor.DEFAULT) {
        widget.connect("enter-event", () => {
            global.display.set_cursor(Meta.Cursor.POINTER);
        });
        widget.connect("leave-event", () => {
            global.display.set_cursor(Meta.Cursor.DEFAULT);
        });
    }
}

interface PopupCtorArgs {
    menu : PopupMenu.PopupMenu;
    metadata : ExtensionMetadata;
    mediaTogglePause : (name : string) => Promise<void>;
    mediaPrev : (name : string) => Promise<void>;
    mediaNext : (name : string) => Promise<void>;
};

export class Popup {

    #mediaTogglePause : (name : string) => void;
    #mediaPrev : (name : string) => void;
    #mediaNext : (name : string) => void;

    #metadata : ExtensionMetadata;
    #coverUri : string | null = null;

    #menuItem : PopupMenu.PopupBaseMenuItem;
    #menuBox : St.BoxLayout;

    #coverBin : St.Widget;
    #coverImg : St.Widget;
    #title : St.Label;
    #artist : St.Label;

    #pauseButton : St.Button;
    #pauseIcon : St.Icon;
    #prevButton : St.Button;
    #nextButton : St.Button;

    #playerName : string | null = null;

    constructor(a : PopupCtorArgs) {
        this.#mediaPrev = a.mediaPrev;
        this.#mediaNext = a.mediaNext;
        this.#mediaTogglePause = a.mediaTogglePause;
        this.#metadata = a.metadata;

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
        this.#artist = new St.Label({
            style_class: "dropbeat-artist",
            text: _g("No Artist")
        });

        const barWidgets = Popup.createControlsBar();
        const controlsBar = barWidgets.bar;
        this.#pauseIcon = barWidgets.pauseIcon;
        this.#pauseButton = barWidgets.pauseButton;
        this.#prevButton = barWidgets.prevButton;
        this.#nextButton = barWidgets.nextButton;

        this.#prevButton.connect("clicked", () => {
            const name = this.#playerName;
            if(name) this.#mediaPrev(name);
        });
        this.#pauseButton.connect("clicked", () => {
            const name = this.#playerName;
            if(name) this.#mediaTogglePause(name);
        });
        this.#nextButton.connect("clicked", () => {
            const name = this.#playerName;
            if(name) this.#mediaNext(name);
        });

        box.add_child(vSpacer(0));
        box.add_child(this.#coverBin);
        box.add_child(vSpacer(20));
        box.add_child(this.#title);
        box.add_child(this.#artist);
        box.add_child(controlsBar);

        this.#menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.#menuItem.actor.add_child(box);

        a.menu.addMenuItem(this.#menuItem);
        
        a.menu.box.set_size(w, h);
        a.menu.box.add_style_class_name("dropbeat-menu");
        this.#menuBox = a.menu.box;
    }

    private static createControlsBar() {
        const bar = new St.BoxLayout({
            vertical: false,
            height: 40,
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: "dropbeat-controls-bar"
        });

        const pauseIcon = new St.Icon({
            icon_name: "media-playback-pause-symbolic",
            icon_size: 40,
            style_class: "system-status-icon"
        });
        const pauseButton = new St.Button({
            style_class: "dropbeat-pause dropbeat-control",
            reactive: true,
            can_focus: true,
            track_hover: true,
            width: 40,
            height: 40,
            x_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            child: pauseIcon
        });
        setPointer(pauseButton);

        const prevIcon = new St.Icon({
            icon_name: "media-skip-backward-symbolic",
            icon_size: 40,
            style_class: "system-status-icon"
        });
        const prevButton = new St.Button({
            style_class: "dropbeat-prev dropbeat-control",
            reactive: true,
            can_focus: true,
            width: 40,
            height: 40,
            x_expand: false,
            x_align: Clutter.ActorAlign.START,
            child: prevIcon
        });
        setPointer(prevButton);

        const nextIcon = new St.Icon({
            icon_name: "media-skip-forward-symbolic",
            icon_size: 40,
            style_class: "system-status-icon"
        });
        const nextButton = new St.Button({
            style_class: "dropbeat-next dropbeat-control",
            reactive: true,
            can_focus: true,
            width: 40,
            height: 40,
            x_expand: false,
            x_align: Clutter.ActorAlign.END,
            child: nextIcon
        });
        setPointer(nextButton);

        bar.add_child(prevButton);
        bar.add_child(pauseButton);
        bar.add_child(nextButton);

        return {
            bar,
            pauseIcon,
            pauseButton,
            prevButton,
            nextButton
        };
    }

    free() {
        this.#menuItem.destroy();
    }

    updateGui(name : string, p : PlayerInfo) : void {
        this.updateGuiAsync(name, p).catch(e => console.error(e));
    }

    async updateGuiAsync(name : string, p : PlayerInfo) : Promise<void> {
        this.#playerName = name;

        this.#title.text = p.title || _g("No Title");
        this.#artist.text = p.artists?.join(_g(" / ")) || _g("No Artist");

        let uri : string;
        if(p.artUrl) uri = p.artUrl;
        else uri = `file://${this.#metadata.path}/music.png`;

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

        if(p.status === "Paused" || p.status === "Stopped") {
            this.#pauseIcon.icon_name = "media-playback-start-symbolic";
        } else {
            this.#pauseIcon.icon_name = "media-playback-pause-symbolic";
        }
    }

}

