/*
    Copyright 2025-2026 Roman Lefler

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

/*
 * This "wnd" part of the project controls the fullscreen player that pops up
 * when clicking the card.
 *
 * This script can be executed via:
 * gjs -m ./wnd/main.js
 * from the build directory.
 */

import Gdk from "gi://Gdk?version=4.0";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import System from "system";
import { Design, UiMan } from "./design.js";

const APP_ID = "com.romanlefler.Dropbeat.Wnd";

export interface UpdateWndArgs {
    title : string;
    album : string;
    artists : string;
    albumArtChanged : boolean;
}

function attachHandlers(app: Gtk.Application, wnd: Gtk.ApplicationWindow) {
    wnd.connect("close-request", () =>
    {
        app.quit();
        return false;
    });

    const click = new Gtk.GestureClick();
    click.connect("pressed", () => {
        wnd.close();
    });
    wnd.add_controller(click);

    const keys = new Gtk.EventControllerKey();
    keys.connect("key-pressed", (_c, keyval) => {
        if(keyval === Gdk.KEY_Escape) {
            wnd.close();
            return true;
        }
        return false;
    });
    wnd.add_controller(keys);
}

function loadCss(dir : string) {
    const provider = new Gtk.CssProvider();
    const path = GLib.build_filenamev([ dir, "..", "wnd.css" ]);
    console.error(path);

    try {
        provider.load_from_path(path);

        const disp = Gdk.Display.get_default();
        if(disp) {
            Gtk.StyleContext.add_provider_for_display(
                disp,
                provider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );
        }
    } catch(e) {
        console.error(e);
        throw e;
    }
}

function main(argv: string[]) {
    const a : UpdateWndArgs = {
        title: argv[0] || "No Title",
        album: argv[1] || "",
        artists: argv[2] || "No Artist",
        albumArtChanged: argv[3] === "1"
    };
    const app = new Gtk.Application({
        application_id: APP_ID,
        flags: Gio.ApplicationFlags.FLAGS_NONE
    });

    app.connect("activate", () => {
        const dir = GLib.path_get_dirname(System.programInvocationName);
        loadCss(dir);

        const wnd = new Gtk.ApplicationWindow(
        {
            application: app,
            title: "Dropbeat",
        });

        attachHandlers(app, wnd);

        const design = new Design(a.title, a.artists);
        const uiMan = new UiMan(design, wnd);
        uiMan.createWidgets();

        wnd.present();
        wnd.fullscreen();
    });

    return app.run([]);
}

main(ARGV);

