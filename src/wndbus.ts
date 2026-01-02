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
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { gettext as _g } from "./gettext.js";

export interface UpdateWndArgs {
    title? : string;
    album? : string;
    artists? : string;
    albumArtChanged : boolean;
}

export class WndBus {

    #extDir : Gio.File;
    #wndMainPath : string;

    #proc : Gio.Subprocess | null = null;

    constructor(ext : Extension) {
        this.#extDir = ext.dir;

        const wnd = this.#extDir.get_child("wnd").get_child("main.js");
        const wndMainPath = wnd.get_path();
        if(!wndMainPath) throw new Error("Cannot get path to wnd main.js");
        this.#wndMainPath = wndMainPath;
    }

    free() : void {
        this.#proc?.force_exit();
        this.#proc = null;
    }

    wndFullscreen(args : UpdateWndArgs) : void {
        const argv : string[] = [
            "gjs",
            "-m",
            this.#wndMainPath,
            args.title || _g("No Title"),
            args.album || "",
            args.artists || _g("No Artist"),
            args.albumArtChanged ? "1" : "0",
        ];
        const proc = new Gio.Subprocess({
            argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        });
        proc.init(null);

        proc.communicate_utf8_async(null, null, (_p, res) => {
            try {
                const [, stdout, stderr] = proc.communicate_utf8_finish(res);

                if (stdout && stdout.length > 0) {
                    console.log(`DropbeatWnd stdout: ${stdout.trimEnd()}`);
                }

                if (stderr && stderr.length > 0) {
                    console.log(`DropbeatWnd stderr: ${stderr.trimEnd()}`);
                }
            }
            catch (e) {
                console.error(e);
            }
        });

        this.#proc = proc;
    }

}
