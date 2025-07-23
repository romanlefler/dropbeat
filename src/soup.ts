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
import Soup from "gi://Soup";

const genericUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.10 Safari/605.1.1";
let soup : Soup.Session | null = null;

export interface HttpResponse<T> {
    status : number;
    data : T | null;
}

export function setUpSoup() : void {
    soup = new Soup.Session({
        user_agent: genericUserAgent
    });
}

export function freeSoup() : void {
    soup?.abort();
    soup = null;
}

export async function fetchBytes(uri : string) : Promise<HttpResponse<Uint8Array>> {
    if(!soup) throw new Error("Soup not initialized.");

    const msg = Soup.Message.new("GET", uri);
    return new Promise<HttpResponse<Uint8Array>>((resolve, reject) => {
        soup!.send_and_read_async(
            msg,
            GLib.PRIORITY_DEFAULT,
            null,
            (_s, result, _userData) => {
                const status = msg.get_status();
                const response = soup!.send_and_read_finish(result);
                const data = response?.get_data();
                resolve({ status, data });
            }
        );
    });
}

export function isOk(status : number) : boolean {
    return status >= 200 && status < 300;
}

