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
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";

export function on1stAllocation(w : Gtk.Widget, fn : (this : Gtk.Widget, aw: number, ah : number) => void) : void {
    w.connect("map", () => {
        w.add_tick_callback(() =>
        {
            const aw = w.parent.get_width();
            const ah = w.parent.get_height();

            if(aw > 0 && ah > 0)
            {
                fn.bind(w, aw, ah)();
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        });
    });
}

export function setRawMargin(w : Gtk.Widget, m : number[]) : void {
    if(m.length !== 4) throw new Error("Invalid raw margin.");

    console.log(`Setting margin: ${m}`);
    if(!isNaN(m[0])) w.marginTop = m[0];
    if(!isNaN(m[1])) w.marginEnd = m[1];
    if(!isNaN(m[2])) w.marginBottom = m[2];
    if(!isNaN(m[3])) w.marginStart = m[3];
}

const marginMapping : Record<number, number[]> = {
    1: [ 0, 0, 0, 0],
    2: [ 0, 1, 0, 1 ],
    3: [ 0, 1, 2, 1 ],
    4: [ 0, 1, 2, 3 ]
};

export function setMargin(w : Gtk.Widget, margin : string) : void {
    let m : RegExpMatchArray | null;
    if(m = margin.match(/^((\s*[\d.]+\s*%?\s*)|\s*n\s*){1,4}$/)) {
        const nums = margin.split(" ");
        if(nums.length < 1 || nums.length > 4) throw new Error("Invalid margin (count must be in [1, 4]).");
        on1stAllocation(w, (aw, ah) => {
            const l = nums.length;
            const m : number[] = [ ];
            for(let i = 0; i < 4; i++) {
                const mapping = marginMapping[l][i];
                const s = nums[mapping].trim();
                let n : number;
                if(s === "n") {
                    n = NaN;
                }
                else if(s.endsWith("%")) {
                    n = parseFloat(s) / 100.0;
                    n *= mapping % 2 === 0 ? ah : aw;
                } else {
                    n = parseFloat(s);
                }
                m.push(n);
            }
            setRawMargin(w, m);
        });
    } else throw new Error("Invalid margin (did not match regex).");
}

