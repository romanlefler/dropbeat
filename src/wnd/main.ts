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

import Gio from "gi://Gio";
import Gdk from "gi://Gdk?version=4.0";
import Gtk from "gi://Gtk?version=4.0";

const APP_ID = "com.romanlefler.Dropbeat.Wnd";

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

function main(argv: string[])
{
    const app = new Gtk.Application(
    {
        application_id: APP_ID,
        flags: Gio.ApplicationFlags.FLAGS_NONE
    });

    app.connect("activate", () =>
    {
        const wnd = new Gtk.ApplicationWindow(
        {
            application: app,
            title: "Dropbeat",
        });

        const box = new Gtk.Box(
        {
            orientation: Gtk.Orientation.VERTICAL,
        });
        box.append(new Gtk.Label({ label: argv.join(" | ") }));

        wnd.set_child(box);

        attachHandlers(app, wnd);

        wnd.present();
        wnd.fullscreen();
    });

    return app.run([]);
}

main(ARGV);
