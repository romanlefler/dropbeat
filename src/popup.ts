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
import { getStandardCover, getBlurredCover, mvToLocation, BannedImageFormatError } from "./imgprocessing.js";
import { WndBus } from "./wndbus.js";
import { IconThemeResolver } from "./iconTheme.js";

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
    //@ts-ignore
    if(widget.set_cursor_type) {
        // GNOME 50
        //@ts-ignore
        widget.set_cursor_type(Clutter.CursorType.POINTER);
    } else if(global?.display?.set_cursor) {
        // Pre-GNOME 50
        widget.connect("enter-event", () => {
            global.display.set_cursor(Meta.Cursor?.POINTER ?? 5);
        });
        widget.connect("leave-event", () => {
            global.display.set_cursor(Meta.Cursor?.DEFAULT ?? 2);
        });
    }
}

interface PopupCtorArgs {
    menu : PopupMenu.PopupMenu;
    metadata : ExtensionMetadata;
    wndBus : WndBus;
    gSettings : Gio.Settings;
    mediaTogglePause : (name : string) => Promise<void>;
    mediaPrev : (name : string) => Promise<void>;
    mediaNext : (name : string) => Promise<void>;
    mediaSeek : (name : string, positionSeconds : number) => Promise<void>;
    mediaRaise : (name : string) => Promise<void>;
};

interface UpdateGuiArgs {
    name : string;
    p : PlayerInfo;
}

export class Popup {

    #mediaTogglePause : (name : string) => void;
    #mediaPrev : (name : string) => void;
    #mediaNext : (name : string) => void;
    #mediaSeek : (name : string, positionSeconds : number) => void;
    #mediaRaise : (name : string) => void;

    #wndBus : WndBus;
    #metadata : ExtensionMetadata;
    #coverUri : string | null = null;
    #stdCoverPath : string = "";
    #blurCoverPath : string = "";

    #menuItem : PopupMenu.PopupBaseMenuItem;
    #menuBox : St.BoxLayout;
    #menu : PopupMenu.PopupMenu;
    #menuOpenHandler : number;
    #progressSettingHandler : number;
    #iconThemeSettingHandler : number;
    #iconTheme : IconThemeResolver | null = null;
    #cardBox : St.BoxLayout;

    #coverBin : St.Widget;
    #coverImg : St.Widget;
    #title : St.Button;
    #artist : St.Label;

    #pauseButton : St.Button;
    #pauseIcon : St.Icon;
    #pauseIconName : string = "media-playback-pause-symbolic";
    #prevButton : St.Button;
    #prevIcon : St.Icon;
    #nextButton : St.Button;
    #nextIcon : St.Icon;
    #progressBar : St.BoxLayout;
    #progressFill : St.Widget;
    #progressRemaining : St.Widget;
    #progressInfo : PlayerInfo | null = null;
    #progressEnabled : boolean = false;

    #playerName : string | null = null;
    readonly #gSettings : Gio.Settings;

    #titleText : string = "";
    #albumText : string = "";
    #artistsText : string = "";

    #currentlyUpdating : boolean = false;
    #queuedUpdate : UpdateGuiArgs | null = null;

    constructor(a : PopupCtorArgs) {
        this.#gSettings = a.gSettings;
        this.#wndBus = a.wndBus;
        this.#mediaPrev = a.mediaPrev;
        this.#mediaNext = a.mediaNext;
        this.#mediaSeek = a.mediaSeek;
        this.#mediaRaise = a.mediaRaise;
        this.#mediaTogglePause = a.mediaTogglePause;
        this.#metadata = a.metadata;
        this.#menu = a.menu;

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
        this.#cardBox = box;
        this.#coverImg = new St.Button({
            style_class: "dropbeat-text dropbeat-cover",
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL
        });
        this.#coverBin = new St.Bin({
            child: this.#coverImg
        });
        setPointer(this.#coverImg);

        // This forces it to be a square
        this.#coverImg.connect("notify::allocation", () => {
            const width = this.#coverBin.allocation.get_width();
            this.#coverBin.set_size(width, width);
        });
        this.#coverImg.connect("clicked", () => {
            a.menu.close(true);
            this.#wndBus.wndFullscreen({
                title: this.#titleText,
                album: this.#albumText,
                artists: this.#artistsText,
                albumArtChanged: true
            }, {
                monitor: this.#gSettings.get_string("fullscreen-monitor"),
                hideCursor: this.#gSettings.get_boolean("hide-cursor"),
                stdcover: this.#stdCoverPath,
                blurcover: this.#blurCoverPath
            });
        });

        this.#title = new St.Button({
            style_class: "dropbeat-title",
            label: _g("No Title"),
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        setPointer(this.#title);
        this.#title.connect("clicked", () => {
            const name = this.#playerName;
            if(name) {
                this.#menu.close(true);
                this.#mediaRaise(name);
            }
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
        this.#prevIcon = barWidgets.prevIcon;
        this.#nextButton = barWidgets.nextButton;
        this.#nextIcon = barWidgets.nextIcon;
        this.#updateIconTheme();
        this.#iconThemeSettingHandler = this.#gSettings.connect(
            "changed::icon-theme-name",
            () => this.#updateIconTheme()
        );

        const progressWidgets = Popup.createProgressBar();
        this.#progressBar = progressWidgets.bar;
        this.#progressFill = progressWidgets.progress;
        this.#progressRemaining = progressWidgets.remaining;
        this.#progressBar.connect("notify::allocation", () => this.#updateProgressBar());
        this.#progressBar.connect("button-release-event", (_bar, event) => {
            const name = this.#playerName;
            const seconds = this.#progressInfo?.seconds;
            if(!name || !seconds) return false;

            const [ stageX, stageY ] = event.get_coords();
            const [ transformed, localX ] = this.#progressBar.transform_stage_point(stageX, stageY);
            const width = this.#progressBar.allocation.get_width();
            if(!transformed || width <= 0) return false;

            const fraction = Math.max(0, Math.min(1, localX / width));
            this.#mediaSeek(name, fraction * seconds);
            return true;
        });
        setPointer(this.#progressBar);
        // @ts-ignore
        this.#menuOpenHandler = this.#menu.connect("open-state-changed", (_menu, isOpen) => {
            if(isOpen && this.#progressEnabled) this.#updateProgressBar();
        });
        this.#progressSettingHandler = this.#gSettings.connect(
            "changed::show-progress-bar",
            settings => this.#setProgressEnabled(settings.get_boolean("show-progress-bar"))
        );

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
        this.#setProgressEnabled(this.#gSettings.get_boolean("show-progress-bar"));

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
            prevIcon,
            prevButton,
            nextIcon,
            nextButton
        };
    }

    private static createProgressBar() {
        const progress = new St.Widget({
            style_class: "dropbeat-progress-fill",
            x_expand: false,
            y_align: Clutter.ActorAlign.FILL
        });
        const remaining = new St.Widget({
            x_expand: false
        });
        const bar = new St.BoxLayout({
            style_class: "dropbeat-progress-bar",
            vertical: false,
            reactive: true,
            track_hover: true,
            x_expand: true,
            y_expand: false
        });

        bar.add_child(progress);
        bar.add_child(remaining);

        return { bar, progress, remaining };
    }

    #updateProgressBar() : void {
        if(!this.#progressEnabled) return;
        const width = this.#progressBar.allocation.get_width();
        const height = this.#progressBar.allocation.get_height();
        if(width <= 0) return;

        const info = this.#progressInfo;
        let fraction = 0;
        if(info?.positionSeconds !== null && info?.seconds) {
            let position = info.positionSeconds;
            if(info.status === "Playing") {
                position += (Date.now() - info.capturedAt.getTime()) / 1000;
            }
            fraction = Math.max(0, Math.min(1, position / info.seconds));
        }

        const progressWidth = fraction > 0
            ? Math.min(width, Math.max(height, width * fraction))
            : 0;
        this.#progressFill.set_width(progressWidth);
        this.#progressRemaining.set_width(width - progressWidth);
    }

    #setProgressEnabled(enabled : boolean) : void {
        if(enabled === this.#progressEnabled) return;
        this.#progressEnabled = enabled;

        if(enabled) {
            this.#cardBox.add_child(this.#progressBar);
            this.#updateProgressBar();
        } else {
            this.#cardBox.remove_child(this.#progressBar);
        }
    }

    #updateIconTheme() : void {
        const name = this.#gSettings.get_string("icon-theme-name");
        this.#iconTheme = name ? new IconThemeResolver(name) : null;
        this.#setControlIcon(this.#prevIcon, "media-skip-backward-symbolic");
        this.#setControlIcon(this.#pauseIcon, this.#pauseIconName);
        this.#setControlIcon(this.#nextIcon, "media-skip-forward-symbolic");
    }

    #setControlIcon(icon : St.Icon, name : string) : void {
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const path = this.#iconTheme?.lookup(name, icon.icon_size, scale);
        if(path) {
            icon.fallback_icon_name = name;
            icon.gicon = new Gio.FileIcon({ file: Gio.File.new_for_path(path) });
        } else {
            icon.set_fallback_icon_name(null);
            icon.icon_name = name;
        }
    }

    free() {
        this.#menu.disconnect(this.#menuOpenHandler);
        this.#gSettings.disconnect(this.#progressSettingHandler);
        this.#gSettings.disconnect(this.#iconThemeSettingHandler);
        this.#iconTheme = null;
        this.#menuItem.destroy();
        this.#menuItem = null!;
    }

    updateGui(name : string, p : PlayerInfo) : void {
        this.#playerName = name;
        this.#progressInfo = p;
        this.#updateProgressBar();
        this.#updateLabels(p);
        this.#updateWnd(false);

        if(this.#currentlyUpdating) {
            this.#queuedUpdate = { name, p };
            return;
        }

        this.#currentlyUpdating = true;
        this.#updateArtInternal({ name, p });
    }
    
    #updateArtInternal(a : UpdateGuiArgs) : void {
        this.#updateArtAsync(a.p).then(() => {
            this.#updateWnd(true);

            if(this.#queuedUpdate) {
                const upd = this.#queuedUpdate!;
                this.#queuedUpdate = null;
                this.#updateArtInternal(upd);
            }
            else {
                this.#currentlyUpdating = false;
            }
        }, e => {
            console.error(e);
            this.#currentlyUpdating = false;
        });
    }

    #updateWnd(artChanged : boolean) : void {
        this.#wndBus?.updateWnd({
            title: this.#titleText,
            album: this.#albumText,
            artists: this.#artistsText,
            albumArtChanged: artChanged
        });
    }

    #updateLabels(p : PlayerInfo) : void {
        this.#title.label = this.#titleText = p.title || _g("No Title");
        this.#artist.text = this.#artistsText = p.artists?.join(_g(" / ")) || _g("No Artist");
        this.#albumText = p.album || "";

        this.#pauseIconName = p.status === "Paused" || p.status === "Stopped"
            ? "media-playback-start-symbolic"
            : "media-playback-pause-symbolic";
        this.#setControlIcon(this.#pauseIcon, this.#pauseIconName);
    }

    async #updateArtAsync(p : PlayerInfo) : Promise<void> {

        let uri : string;
        if(p.artUrl) uri = p.artUrl;
        else uri = `file://${this.#metadata.path}/music.png`;

        if(this.#coverUri !== uri) {
            let art : string, blurred : string;
            try {
                const allowHttp = this.#gSettings.get_boolean("album-cover-internet");
                const isHttpsOnly = this.#gSettings.get_boolean("https-only");
                art = await getStandardCover(uri, allowHttp, isHttpsOnly);
                blurred = await getBlurredCover(art);
            } catch(e) {
                if(e instanceof Gio.ResolverError || e instanceof BannedImageFormatError) {
                    console.warn(`Failed to process cover art "${uri}": ${e.message}\n${e.stack}\nEnd of error backtrace.\n`);
                    const f = `file://${this.#metadata.path}/music.png`;
                    art = await getStandardCover(f, false, true);
                    blurred = await getBlurredCover(art);
                } else throw e;
            }
            
            // This line updates the actual files so that they're both done at once
            const [imgArt, imgBlurred ] = await mvToLocation(art, blurred);
            this.#stdCoverPath = imgArt;
            this.#blurCoverPath = imgBlurred;

            this.#coverImg.style = `background-image: url('${imgArt}');`;
            this.#menuBox.style = `background-image: url('${imgBlurred}');`;

            this.#coverUri = uri;
        }

    }

}
