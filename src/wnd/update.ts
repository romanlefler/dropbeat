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

/*
 * This script is imported into wnd/main and is not imported into the shell or prefs processes.
 */

import GLib from "gi://GLib";
import Gio from "gi://Gio";
// @ts-ignore
import GioUnix from "gi://GioUnix";
import { Design, UiMan } from "./design.js";
import { UpdateWndArgs } from "./main.js";

export function beginReadCmdline(design : Design, uiMan : UiMan) : void {

    const stdin = new Gio.DataInputStream({
        base_stream: new GioUnix.InputStream({
            fd: 0,
            close_fd: false,
        }),
        close_base_stream: true,
    });

    function read() {
        stdin.read_line_async(GLib.PRIORITY_DEFAULT, null, (_, res) => {
            try {
                const [ line ] = stdin.read_line_finish_utf8(res);
                if (line === null) return;

                const a = JSON.parse(line) as UpdateWndArgs;

                design.setTitle(a.title);
                design.setArtist(a.artists);
                uiMan.update();
            } catch (e) {
                console.error(e);
            }

            read();
        });
    }

    read();
}

