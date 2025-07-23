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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import { fetchBytes, isOk } from "./soup.js";

const BLUR_RADIUS = "0x40";

async function getDir() : Promise<string> {
    const dir = Gio.File.new_for_path("/tmp/dropbeat");
    return new Promise<string>((resolve, reject) => {
        dir.make_directory_async(GLib.PRIORITY_DEFAULT, null, () => {
            const path = dir.get_path();
            if(path) resolve(path);
            else reject("Couldn't create temp directory.");
        });
    });
}

async function cp(source : Gio.File, dest : Gio.File) : Promise<void> {
    return new Promise<void>((resolve, reject) => {
        source.copy_async(
            dest,
            Gio.FileCopyFlags.OVERWRITE,
            GLib.PRIORITY_DEFAULT,
            null,
            null,
            (_source, result) => {
                try {
                    const ok = source.copy_finish(result);
                    if(ok) resolve();
                    else reject(`Couldn't copy ${source.get_path()} to ${dest.get_path()}.`);
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

async function write(file : Gio.File, data : Uint8Array) : Promise<void> {
    return new Promise<void>((resolve, reject) => {
        file.replace_async(
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            GLib.PRIORITY_DEFAULT,
            null,
            (_f, resultReplace) => {
                const out = file.replace_finish(resultReplace);
                if(!out) return reject(`Couldn't open ${file.get_path()} for writing.`);
                out.write_bytes_async(data, GLib.PRIORITY_DEFAULT, null, (stream, result) => {
                    try {
                        const nBytes = out.write_bytes_finish(result);
                        if(nBytes !== data.length) return reject("Couldn't write to stream.");
                        out.close_async(GLib.PRIORITY_DEFAULT, null, (_s, resultClose) => {
                            try {
                                const closed = out.close_finish(resultClose);
                                if(closed) resolve();
                                else reject("Couldn't close stream.");
                            } catch (e) {
                                reject(e);
                            }
                        });
                    } catch (e) {
                        reject(e);
                    }
                });
            }
        );
    });
}

async function readStreamAsync(stream : Gio.DataInputStream) : Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
        stream.read_until_async("", GLib.PRIORITY_DEFAULT, null, (_stream, result) => {
            try {
                const [ str, len ] = stream.read_until_finish(result);
                if(!len) resolve(null);
                else resolve(str);
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function spawnAsync(argv : string[]) : Promise<boolean> {
    const [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
        null,
        argv,
        null,
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null
    );
    if(!pid) throw new Error(`Couldn't spawn command '${argv.join(" ")}'.`);
    return new Promise<boolean>((resolve, reject) => {
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, async (_pid, status) => {
            try {
                const exitCode = status >> 8;
                if(!exitCode) {
                    resolve(true);
                } else {
                        const stderrStream = new Gio.UnixInputStream({ fd: stderr, close_fd: false });
                        const dataStream = new Gio.DataInputStream({ base_stream: stderrStream });
                        const errorMsg = await readStreamAsync(dataStream);
                        console.error(`Command '${argv.join(" ")}' failed with status ${exitCode}: ${errorMsg}.`);
                        resolve(false);
                }
            } catch(e) {
                reject(e);
            } finally {
                GLib.spawn_close_pid(pid);
            }
        });
    });
}

export async function getStandardCover(uri : string) : Promise<string> {
    try {
        const dir = await getDir();
        const file = Gio.File.new_for_path(`${dir}/standard`);
        if(uri.startsWith("http://") || uri.startsWith("https://")) {
            const { status, data } = await fetchBytes(uri);
            if(!isOk(status) || !data) throw new Error("Couldn't fetch image.");
            await write(file, data);
            return file.get_path()!;
        } else if(uri.startsWith("file://")) {
            await cp(Gio.File.new_for_uri(uri), file);
            return file.get_path()!;
        } else {
            throw new Error(`Unknown URI protocol '${uri}'`);
        }
    } catch(e) {
        console.error(`Error getting standard cover: ${e}`);
        throw e;
    }
}

export async function getBlurredCover(originalPath : string) : Promise<string> {
    const dir = await getDir();
    const file = Gio.File.new_for_path(`${dir}/blurred`);
    const originalFile = Gio.File.new_for_path(originalPath);
    const success = await spawnAsync([ "magick", originalFile.get_path()!, "-blur", BLUR_RADIUS, file.get_path()! ]);

    if(success && file.query_exists(null)) return file.get_path()!;
    throw new Error(`Failed to create blurred cover.`);
}

export function clearTempFiles() : void {
    const file = Gio.File.new_for_path("/tmp/dropbeat");
    file.delete(null);
}

