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

import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from 'gi://St';
import { gettext as _g } from "./gettext.js"
import { ModalDialog } from "resource:///org/gnome/shell/ui/modalDialog.js";
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { spawnAsync } from "./imgprocessing.js";

function paragraph(text : string, ...formatArgs : string[]) : St.Label {
    const label = new St.Label({
        text: text.format(...formatArgs),
        style_class: "dialog-description",
        x_expand: true,
        y_expand: true,
        reactive: false,
        x_align: Clutter.ActorAlign.FILL,
        y_align: Clutter.ActorAlign.FILL
    });
    label.clutter_text.line_wrap = true;
    return label;
}

class MagickDialog extends ModalDialog {

    readonly #okay : St.Button;

    static {
        GObject.registerClass(this);
    }

    constructor() {
        super();

        const title = _g("Welcome to %s").format("Dropbeat");
        const titleLabel = new St.Label({
            text: title,
            style_class: "modal-dialog-title",
            style: "font-weight: bold;",
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            margin_bottom: 25
        });
        this.contentLayout.add_child(titleLabel);

        const box = new St.BoxLayout({
            vertical: true,
            style_class: "dialog-content",
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER
        });

        const weatherProv = paragraph(_g(
            "This extension requires %s, a popular tool to " +
            "process images.\n" +
            "\n" +
            "Please install ImageMagick and restart the extension.\n" +
            "  \u2022  %s\n" +
            "  \u2022  %s\n" +
            "  \u2022  %s\n" +
            "\n"
        ),
            "ImageMagick",
            "Debian: sudo apt install imagemagick",
            "Fedora: sudo dnf install imagemagick",
            "Arch: sudo pacman -S imagemagick"
        );
        box.add_child(weatherProv);

        const thanks = paragraph(_g(
            "Thank you for installing %s!"
        ), "Dropbeat");
        box.add_child(thanks);

        const spacer = new St.Widget({ height: 30 });
        box.add_child(spacer);

        const buttonBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            margin_top: 25
        });

        const okay = new St.Button({ 
            label: "OK",
            x_expand: true,
            style_class: "modal-dialog-button",
        });
        buttonBox.add_child(okay);
        box.add_child(buttonBox);

        this.contentLayout.add_child(box);
        okay.grab_key_focus();

        this.#okay = okay;
    }

    choose() : Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.#okay.connect("clicked", () => {
                this.close();
                resolve();
            });
            this.open();
        });
    }
}

export async function showMagickDialogue() : Promise<void> {
    const dialog = new MagickDialog();
    return dialog.choose();
}

export async function checkMagick() : Promise<boolean> {
    return await spawnAsync([ "magick", "-version" ], false) as unknown as Promise<boolean>;
}

export async function ensureMagick(settings : Gio.Settings) : Promise<boolean> {
    if(settings.get_boolean("has-magick")) return true;

    const hasMagick = await checkMagick();
    if(!hasMagick) {
        await showMagickDialogue();
        return false;
    }

    settings.set_boolean("has-magick", true);
    return true;
}


