/*
    Copyright 2026 Roman Lefler

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
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import * as Utils from "./utils.js";

const COVER = "/tmp/dropbeat/standard";
const BLURRED = "/tmp/dropbeat/blurred";

export class Design {
    #title : string;
    #artist : string;

    constructor(title : string, artist : string) {
        this.#title = title;
        this.#artist = artist;
    }

    getTitle() : string {
        return this.#title;
    }

    setTitle(title : string) : void {
        this.#title = title;
    }

    getArtist() : string {
        return this.#artist;
    }
    
    setArtist(artist : string) : void {
        this.#artist = artist;
    }
}

export class UiMan {
    #overlay? : Gtk.Overlay;
    #bgImg? : Gtk.Picture;
    #foreground? : Gtk.Box;

    #design : Design;
    #wnd : Gtk.ApplicationWindow;
    constructor(design : Design, wnd : Gtk.ApplicationWindow) {
        this.#design = design;
        this.#wnd = wnd;
    }

    createWidgets() : void {
        this.#overlay = new Gtk.Overlay();
        this.#bgImg = new Gtk.Picture({
            content_fit: Gtk.ContentFit.COVER,
            file: Gio.File.new_for_path(BLURRED)
        });

        this.#overlay.set_child(this.#bgImg);
        this.#overlay.add_overlay(this.#createForeground());
        this.#wnd.set_child(this.#overlay);
    }

    #createForeground() : Gtk.Box {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });

        const coverFrame = new Gtk.AspectFrame({
            ratio: 1.0,
            obey_child: true,
            width_request: 280,
            height_request: 280,
            halign: Gtk.Align.CENTER,
            overflow: Gtk.Overflow.HIDDEN,
            css_classes: [ "cover-frame" ]
        });
        Utils.setMargin(coverFrame, "10% 10% 5%");
        const coverClip = new Gtk.Box({
            hexpand: true,
            vexpand: true,
            overflow: Gtk.Overflow.HIDDEN,
            css_classes: [ "cover-clip" ]
        });
        coverFrame.set_child(coverClip);

        const cover = new Gtk.Picture({
            content_fit: Gtk.ContentFit.COVER,
            file: Gio.File.new_for_path(COVER)
        });
        coverClip.append(cover);

        // labels
        const title = new Gtk.Label({
            label: this.#design.getTitle(),
            halign: Gtk.Align.CENTER,
            css_classes: [ "title-text" ]
        });
        Utils.setMargin(title, "5% n n");

        const artist = new Gtk.Label({
            label: this.#design.getArtist(),
            halign: Gtk.Align.CENTER,
            css_classes: [ "artist-text" ]
        });
        Utils.setMargin(artist, "n n 10%");

        box.append(coverFrame);
        box.append(title);
        box.append(artist);

        return box;
    }

    update() : void {
        if(!this.#overlay) throw new Error("Dropbeat Wnd: UiMan not initialized.");
    }
}

