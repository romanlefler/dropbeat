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
import GLib from "gi://GLib";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { gettext as _g } from "./gettext.js";

export interface UpdateWndArgs {
    title? : string;
    album? : string;
    artists? : string;
    albumArtChanged : boolean;
}

export interface CreateWndArgs {
    monitor: string;
    hideCursor: boolean;
    stdcover: string;
    blurcover: string;
}

interface WndProcess {
    proc : Gio.Subprocess;
    stdin : Gio.OutputStream | null;
    cancellable : Gio.Cancellable;
}

export class WndBus {

    #extDir : Gio.File;
    #wndMainPath : string;

    #active : WndProcess | null = null;

    #logOutput(s : Gio.InputStream, isError : boolean, cancellable : Gio.Cancellable) : void {
        s.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, cancellable, (_, res) => {
            try {
                const bytes = s.read_bytes_finish(res);
                if(!bytes.get_size()) return;
                const txt = new TextDecoder().decode(bytes.toArray());
                if(txt) {
                    if(isError) {
                        const msg = `DropbeatWnd stderr: ${txt.trimEnd()}`;
                        switch(txt.substring(0, txt.indexOf(':')).trim()) {
                            case "Gjs-Console-Message": case "Gjs-Message":

                                // EGO doesn't want you doing ?version= anyway
                                if(msg.includes("but it has") && msg.includes("versions available")) break;

                                console.log(msg);
                                break;
                            case "Gjs-Critical":
                                console.error(msg);
                            default:
                                console.warn(msg);
                        }
                    }
                    else console.log(`DropbeatWnd stdout: ${txt.trimEnd()}`)
                }
                this.#logOutput(s, isError, cancellable);
            } catch(e) {
                if(!cancellable.is_cancelled()) console.error(e);
            }
        });
    }

    constructor(ext : Extension) {
        this.#extDir = ext.dir;

        const wnd = this.#extDir.get_child("wnd").get_child("main.js");
        const wndMainPath = wnd.get_path();
        if(!wndMainPath) throw new Error("Cannot get path to wnd main.js");
        this.#wndMainPath = wndMainPath;
    }

    free() : void {
        const active = this.#active;
        this.#active = null;
        if(!active) return;

        active.cancellable.cancel();
        active.proc.force_exit();
    }

    wndFullscreen(args : UpdateWndArgs, createArgs : CreateWndArgs) : void {
        this.free();

        const argv : string[] = [
            "gjs",
            "-m",
            this.#wndMainPath,
            JSON.stringify(createArgs),
            args.title || _g("No Title"),
            args.album || "",
            args.artists || _g("No Artist"),
            args.albumArtChanged ? "1" : "0",
        ];
        const proc = new Gio.Subprocess({
            argv,
            flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        });
        proc.init(null);

        const active : WndProcess = {
            proc,
            stdin: proc.get_stdin_pipe(),
            cancellable: new Gio.Cancellable(),
        };
        this.#active = active;

        try {
            const stdout = proc.get_stdout_pipe();
            const stderr = proc.get_stderr_pipe();
            if(stdout) this.#logOutput(stdout, false, active.cancellable);
            if(stderr) this.#logOutput(stderr, true, active.cancellable);
        } catch(e) {
            console.error(e);
        }

        proc.wait_async(active.cancellable, (_, res) => {
            try {
                proc.wait_finish(res);
            } catch (e) {
                if(!active.cancellable.is_cancelled()) console.error(e);
            } finally {
                if(this.#active === active) this.#active = null;
            }
        });
    }

    updateWnd(a: UpdateWndArgs): void {
        const active = this.#active;
        const stdin = active?.stdin;
        if(!active || !stdin) return;

        const msg = JSON.stringify({
            title: a.title || _g("No Title"),
            album: a.album || "",
            artists: a.artists || _g("No Artist"),
            albumArtChanged: a.albumArtChanged,
        }) + "\n";

        try {
            stdin.write_bytes_async(
                new GLib.Bytes(new TextEncoder().encode(msg)),
                GLib.PRIORITY_DEFAULT,
                active.cancellable,
                (_, res) => {
                    try {
                        stdin.write_bytes_finish(res);
                    } catch (e) {
                        if(!active.cancellable.is_cancelled())
                            console.error(`DropbeatWnd stdin write failed: ${e}`);
                    }
                }
            );
        } catch(e) {
            console.error(e);
        }
    }

}
