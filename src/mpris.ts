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

const bus = Gio.DBus.session;

const subs : number[] = [ ];

export type PlayerCallback = (name : string) => void;

export function mediaLaunched(started : PlayerCallback, exited : PlayerCallback) : void {
    const id = bus.signal_subscribe(
        "org.freedesktop.DBus",
        "org.freedesktop.DBus",
        "NameOwnerChanged",
        null,
        null,
        Gio.DBusSignalFlags.NONE,
        (_conn, _sender, _objectPath, _interfaceName, _signalName, params) => {
            let nameV : GLib.Variant, oldOwnerV : GLib.Variant, newOwnerV : GLib.Variant;
            [ nameV, oldOwnerV, newOwnerV ] = params.unpack() as any;
            const name = nameV.get_string()[0];
            const oldOwner = oldOwnerV.get_string()[0];
            const newOwner = newOwnerV.get_string()[0];

            if(!name.startsWith("org.mpris.MediaPlayer2.")) return;
            if(!oldOwner && newOwner)
            {
                started(name);
            }
            else if(oldOwner && !newOwner)
            {
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

export function mediaFree() : void {
    let id : number | undefined;
    while((id = subs.pop()) !== undefined) bus.signal_unsubscribe(id);
}

