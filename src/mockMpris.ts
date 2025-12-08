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

// This is a mock implementation of mpris.ts so you don't have to actually run a media player

import Gio from "gi://Gio";
import { PlayerInfo, PlayerCallback } from "./mpris.js";

export type { PlayerInfo, PlayerCallback } from "./mpris.js"

let isPlaying : boolean = true;
let changedHandler : PlayerCallback | null = null;

export function setBusSession(bus : Gio.DBusConnection | null) {
    return;
}

export function mediaLaunched(
    _started : PlayerCallback, _exited : PlayerCallback, changed : PlayerCallback
) : void {
    changedHandler = changed;
}

export async function getMediaPlayers() : Promise<string[]> {
    return [ "org.mpris.MediaPlayer2.MockPlayer" ];
}

export function mediaQueryPlayer(name : string) : PlayerInfo | null {
    return {
        title: "Everything Is Alright",
        artists: [ "Motion City Soundtrack" ],
        album: "Commit This to Memory",
        trackN: 2,
        discN: 1,
        genres: [ "Pop Punk", "Emo", "Rock" ],
        release: new Date("2005-06-07"),
        artUrl: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse3.mm." +
            "bing.net%2Fth%2Fid%2FOIP.kVjNx2oThEosDC-GPybDPQHaHa%3Fpid%3DApi&f=1&ipt=" +
            "c808b452cde05f49638bef772359332dd1aa2c16bfacb1bd03d2bc4efb6d723d&ipo=images",
        seconds: 207,
        status: isPlaying ? "Playing" : "Paused"
    };
}

export async function mediaTogglePause(name : string) : Promise<void> {
    isPlaying = !isPlaying;
    changedHandler?.(name);
}

export async function mediaPrev(name : string) : Promise<void> {
    return;
}

export async function mediaNext(name : string) : Promise<void> {
    return;
}

export function mediaFree() : void {
    return;
}

