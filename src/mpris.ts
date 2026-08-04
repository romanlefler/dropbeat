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
import { str, i64, i32 } from "./gvariant.js";

export type PlayerCallback = (name : string) => void;

let bus : Gio.DBusConnection | null = null;
let mediaChangedCallback: PlayerCallback | null = null;

let proxies : Record<string, Gio.DBusProxy> = { };
let subs : number[] = [ ];

const WEB_BROWSER_IDS = [
    "firefox", // Firefox, LibreWolf, Waterfox
    "chrome",
    "chromium", // Chromium, Opera
    "brave",
    "edge",
    "vivaldi",
    "plasma_browser_integration" // KDE Plasma Browser
];

export function setBusSession(dbusSession : Gio.DBusConnection | null) {
    bus = dbusSession;
    proxies = { };
    subs = [ ];
}

export async function mediaLaunched(
    started : PlayerCallback, exited : PlayerCallback, changed : PlayerCallback
) : Promise<void> {
    if(!bus) throw new Error("Set bus session first.");
    mediaChangedCallback = changed;
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

    // Add change handlers and add proxies for existing players
    getMediaPlayers();
}

export async function getMediaPlayers() : Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        if(!bus) throw new Error("Set bus session first.");
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
            async (_conn, result) => {
                try {
                    if(!bus) return reject(new Error("Bus set to NULL before response."));
                    const namesV = bus.call_finish(result);
                    const names : string[] = (namesV.deep_unpack() as any)[0];
                    const players = names.filter(s => s.startsWith("org.mpris.MediaPlayer2."));
                    // If there were players before the extension started they wont be in the proxy list yet
                    for(let p of players) {
                        if(!(p in proxies)) {
                            proxies[p] = await createProxy(p);
                            mediaChanged(proxies[p], () => mediaChangedCallback?.(p));
                        }
                    }
                    resolve(players);
                } catch (e) {
                    console.error(`Dropbeat: Failed to list media players: ${e}`);
                    resolve([ ]);
                }
            }
        );
    });
}

async function createProxy(name : string) : Promise<Gio.DBusProxy> {
    return new Promise<Gio.DBusProxy>((resolve, reject) => {
        if(!bus) return reject(new Error("Set bus session first."));
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
    proxy.connect("g-signal", (_proxy, _sender, signal) => {
        if(signal === "Seeked") callback();
    });
}

function queryProperty(
    proxy : Gio.DBusProxy, interfaceName : string, propertyName : string
) : GLib.Variant | null {
    const result = proxy.get_connection().call_sync(
        proxy.get_name(),
        proxy.get_object_path(),
        "org.freedesktop.DBus.Properties",
        "Get",
        new GLib.Variant("(ss)", [ interfaceName, propertyName ]),
        new GLib.VariantType("(v)"),
        Gio.DBusCallFlags.NONE,
        1000,
        null
    );
    return result.get_child_value(0).get_variant();
}

function queryPosition(proxy : Gio.DBusProxy) : number | null {
    let positionV = proxy.get_cached_property("Position");
    try {
        positionV = queryProperty(proxy, "org.mpris.MediaPlayer2.Player", "Position");
    } catch(e) {
        console.warn(`Dropbeat: Failed to query current media position: ${e}`);
    }
    return i64(positionV);
}

export function isWebBrowser(name : string) : boolean {
    // You could try to dynamically detect web browsers by inspecting
    // the category in the Desktop file, however Chromium browsers do
    // not implement the desktop entry MPRIS property, which leaves
    // us out of luck for most browsers.
    console.error(`Is Web Browser? ${name}`);
    const prefix = "org.mpris.MediaPlayer2.";
    if (!name.startsWith(prefix)) return false;
    // The ID match is pretty lenient to account for some weird cases
    // like appending suffices like ".instance9148"
    const id = name.slice(prefix.length).toLowerCase();
    return WEB_BROWSER_IDS.some(browser => {
        return id === browser || id.startsWith(`${browser}.`);
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
    positionSeconds : number | null;
    capturedAt : Date;
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
        const position = queryPosition(proxy);
        const capturedAt = new Date();
        return {
            title: str(meta["xesam:title"]),
            artists: meta["xesam:artist"]?.deep_unpack() ?? null,
            album: str(meta["xesam:album"]),
            trackN: i32(meta["xesam:trackNumber"]),
            discN: i32(meta["xesam:discNumber"]),
            genres: meta["xesam:genre"]?.deep_unpack() ?? null,
            release: date ? new Date(date) : null,
            artUrl: str(meta["mpris:artUrl"]),
            seconds: sec ? sec / 1000000 : null,
            positionSeconds: position !== null ? position / 1000000 : null,
            capturedAt,
            status: status
        };
        
    } catch(e) {
        console.error(`Dropbeat: Failed to query media player ${name}: ${e}`);
        return null;
    }
}

async function mediaCallMethod(
    name : string, method : string, parameters : GLib.Variant | null = null
) : Promise<void> {
    const proxy = proxies[name];
    if(!proxy) throw new Error(`No proxy for media player ${name}.`);
    return new Promise<void>((resolve, reject) => {
        proxy.call(
            method,
            parameters,
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
                    return reject(new Error(`${method} failed on player ${name}: ${e}`));
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

export async function mediaSeek(name : string, positionSeconds : number) : Promise<void> {
    const proxy = proxies[name];
    if(!proxy) throw new Error(`No proxy for media player ${name}.`);

    const currentPosition = queryPosition(proxy);
    if(currentPosition === null) throw new Error(`No position for media player ${name}.`);

    const target = Math.max(0, positionSeconds * 1000000);
    const offset = Math.round(target - currentPosition);
    return mediaCallMethod(name, "Seek", new GLib.Variant("(x)", [ offset ]));
}

export async function mediaRaise(name : string) : Promise<void> {
    if(!bus) throw new Error("Set bus session first.");
    return new Promise<void>((resolve, reject) => {
        bus!.call(
            name,
            "/org/mpris/MediaPlayer2",
            "org.mpris.MediaPlayer2",
            "Raise",
            null,
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, result) => {
                if(!connection) return reject(new Error(`Raise failed on player ${name}: no connection.`));
                try {
                    connection.call_finish(result);
                    resolve();
                } catch(e) {
                    reject(new Error(`Raise failed on player ${name}: ${e}`));
                }
            }
        );
    });
}

export function mediaFree() : void {
    let id : number | undefined;
    if(bus) {
        while((id = subs.pop()) !== undefined) bus.signal_unsubscribe(id);
    }

    proxies = { };
    subs = [ ];
    bus = null;
}
