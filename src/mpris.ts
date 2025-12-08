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

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { str, i64 } from "./gvariant.js";

let bus = Gio.DBus.session;

const proxies : Record<string, Gio.DBusProxy> = { };
const subs : number[] = [ ];

export type PlayerCallback = (name : string) => void;

export function mediaLaunched(
    started : PlayerCallback, exited : PlayerCallback, changed : PlayerCallback
) : void {
    const id = bus.signal_subscribe(
        "org.freedesktop.DBus",
        "org.freedesktop.DBus",
        "NameOwnerChanged",
        null,
        null,
        Gio.DBusSignalFlags.NONE,
        async (_conn, _sender, _objectPath, _interfaceName, _signalName, params) => {
            let nameV : GLib.Variant, oldOwnerV : GLib.Variant, newOwnerV : GLib.Variant;
            [ nameV, oldOwnerV, newOwnerV ] = params.unpack() as any;
            const name = nameV.get_string()[0];
            const oldOwner = oldOwnerV.get_string()[0];
            const newOwner = newOwnerV.get_string()[0];

            if(!name.startsWith("org.mpris.MediaPlayer2.")) return;
            if(!oldOwner && newOwner)
            {
                proxies[name] = await createProxy(name);
                mediaChanged(proxies[name], () => changed(name));
                started(name);
            }
            else if(oldOwner && !newOwner)
            {
                delete proxies[name];
                exited(name);
            }
        }
    );
    subs.push(id);
}

export async function getMediaPlayers() : Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        bus.call(
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "ListNames",
            null,
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (_conn, result) => {
                try {
                    const namesV = bus.call_finish(result);
                    const names : string[] = (namesV.deep_unpack() as any)[0];
                    const players = names.filter(s => s.startsWith("org.mpris.MediaPlayer2."));
                    resolve(players);
                } catch (e) {
                    console.error(`Failed to list media players: ${e}`);
                    resolve([ ]);
                }
            }
        );
    });
}

async function createProxy(name : string) : Promise<Gio.DBusProxy> {
    return new Promise<Gio.DBusProxy>((resolve, reject) => {
        Gio.DBusProxy.new(
            bus,
            Gio.DBusProxyFlags.NONE,
            null,
            name,
            "/org/mpris/MediaPlayer2",
            "org.mpris.MediaPlayer2.Player",
            null,
            (_, result) => {
                const proxy = Gio.DBusProxy.new_finish(result);
                resolve(proxy);
            }
        );
    });
}

function mediaChanged(proxy : Gio.DBusProxy, callback : () => void) : void {
    proxy.connect("g-properties-changed", (_, props) => {
        const changed : string[] = props.deep_unpack();
        if("Metadata" in changed || "PlaybackStatus" in changed) callback();
    });
}

export interface PlayerInfo {
    title : string | null;
    artists : string[] | null;
    album : string | null;
    trackN : number | null;
    discN : number | null;
    genres : string[] | null;
    release : Date | null;
    artUrl : string | null;
    seconds : number | null;
    status : "Playing" | "Paused" | "Stopped" | null;
}

export function mediaQueryPlayer(name : string) : PlayerInfo | null {
    try {
        const proxy = proxies[name];
        if(!proxy) throw new Error(`No proxy for media player ${name}`);

        const statusV = proxy.get_cached_property("PlaybackStatus");
        const status = statusV?.deep_unpack() as string ?? null;
        if(status !== "Playing" && status !== "Paused" && status !== "Stopped" && status !== null) {
            throw new Error(`Unknown playback status "${status}" for media player ${name}`);
        }

        const metaV = proxy.get_cached_property("Metadata");
        if(!metaV) throw new Error(`No metadata for media player ${name}`);

        const meta : Record<string, GLib.Variant> = { };
        const len = metaV.n_children();
        if(!len) return null;
        for(let i = 0; i < len; i++) {
            const item = metaV.get_child_value(i);
            const key = str(item.get_child_value(0))!;
            const value = item.get_child_value(1);
            meta[key] = value.get_variant();
        }

        const date = str(meta["xesam:contentCreated"]);
        const sec = i64(meta["mpris:length"]);
        return {
            title: str(meta["xesam:title"]),
            artists: meta["xesam:artist"]?.deep_unpack() ?? null,
            album: str(meta["xesam:album"]),
            trackN: i64(meta["xesam:trackNumber"]),
            discN: i64(meta["xesam:discNumber"]),
            genres: meta["xesam:genre"]?.deep_unpack() ?? null,
            release: date ? new Date(date) : null,
            artUrl: str(meta["mpris:artUrl"]),
            seconds: sec ? sec / 1000000 : null,
            status: status
        };
        
    } catch(e) {
        console.error(`Failed to query media player ${name}: ${e}`);
        return null;
    }
}

async function mediaCallMethod(name : string, method : string) : Promise<void> {
    const proxy = proxies[name];
    if(!proxy) throw new Error(`No proxy for media player ${name}.`);
    return new Promise<void>((resolve, reject) => {
        proxy.call(
            method,
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (p, result) =>
            {
                if(!p) return reject("Media player was NULL.");
                try
                {
                    p.call_finish(result);
                }
                catch(e)
                {
                    return reject(new Error(`Toggle pause failed on player ${name}: ${e}`));
                }
                resolve();
            }
        );
    });
};

export async function mediaTogglePause(name : string) : Promise<void> {
    return mediaCallMethod(name, "PlayPause");
}

export async function mediaPrev(name : string) : Promise<void> {
    return mediaCallMethod(name, "Previous");
}

export async function mediaNext(name : string) : Promise<void> {
    return mediaCallMethod(name, "Next");
}

export function mediaFree() : void {
    let id : number | undefined;
    while((id = subs.pop()) !== undefined) bus.signal_unsubscribe(id);

    for(const p in proxies) delete proxies[p];

    // @ts-ignore
    bus = null;
}

