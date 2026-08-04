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

/**
 * @throws Gio.ResolverError
 */
export async function fetchBytesInternal(uri : string, allowRedirects : boolean, enforceHttps : boolean) : Promise<[ HttpResponse<Uint8Array>, Soup.Message ]> {
    if(!soup) throw new Error("Soup not initialized.");

    const msg = Soup.Message.new("GET", uri);
    if(!msg) throw new Error("Invalid soup URI.");

    if(!allowRedirects) msg.add_flags(Soup.MessageFlags.NO_REDIRECT);
    if(enforceHttps && msg.get_uri().get_scheme() !== "https") throw new Error("HTTPS-only mode; not following plain HTTP.");
    const response = new Promise<[ HttpResponse<Uint8Array>, Soup.Message ]>((resolve, reject) => {
        soup!.send_and_read_async(
            msg,
            GLib.PRIORITY_DEFAULT,
            null,
            (_s, result, _userData) => {
                try {
                    const status = msg.get_status();
                    const response = soup!.send_and_read_finish(result);
                    const data = response?.get_data();
                    resolve([ { status, data }, msg ]);
                } catch(e) {
                    reject(e);
                }
            }
        );
    });

    return response;
}

export async function fetchBytes(uri : string, httpsOnly : boolean) : Promise<HttpResponse<Uint8Array>> {
    if(httpsOnly) return fetchBytesHttpsOnly(uri);
    else return (await fetchBytesInternal(uri, true, false))[0];
}

/**
 * Follows HTTPS redirects, but rejects redirects to HTTP.
 *
 * @throws Gio.ResolverError
 * @throws Error for non-HTTPS URIs or excessive redirects
 */
async function fetchBytesHttpsOnly(uri : string) : Promise<HttpResponse<Uint8Array>> {
    if(!soup) throw new Error("Soup not initialized.");

    let redirects = 0;
    while(true) {
        const [ response, msg ] = await fetchBytesInternal(uri, false, true);
        if(!isRedirect(response.status)) return response;

        const location = msg.get_response_headers().get_one("Location");
        if(!location) return response;

        if(redirects++ >= 10) throw new Error("Too many redirects.");

        uri = msg
            .get_uri()
            .parse_relative(location, Soup.HTTP_URI_FLAGS)
            .to_string();
    }
}

function isRedirect(status : number) : boolean {
    return [ 301, 302, 303, 307, 308 ].includes(status);
}

export function isOk(status : number) : boolean {
    return status >= 200 && status < 300;
}

