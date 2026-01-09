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
import Gdk from "gi://Gdk?version=4.0";
import Gtk from "gi://Gtk?version=4.0";

const COVER = "/tmp/dropbeat/standard";
const BLURRED = "/tmp/dropbeat/blurred";

export class Design {
    #title : string;

    constructor(title : string) {
        this.#title = title;
    }

    getTitle() : string {
        return this.#title;
    }

    setTitle(title : string) : void {
        this.#title = title;
    }
}

export class UiMan {
    #overlay? : Gtk.Overlay;
    #bgImg? : Gtk.Picture;

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
        this.#wnd.set_child(this.#overlay);
    }

    update() : void {
        if(!this.#overlay) throw new Error("Dropbeat Wnd: UiMan not initialized.");
    }
}

