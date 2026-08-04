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

import Gdk from "gi://Gdk";
import { gettext as _g } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export interface MonitorFingerprint {
    manufacturer : string;
    model : string;
    widthmm : number;
    heightmm : number;
    connector : string;
}

export interface MonitorOption {
    label : string;
    fingerprint : MonitorFingerprint;
}

const MONITOR_ALIASES : Record<string, string> = {
    "SAM": "Samsung",
    "DEL": "Dell",
    "DLL": "Dell",
    "AUS": "ASUS",
    "ACR": "Acer",
    "APP": "Apple",
    "LEN": "Lenovo",
    "GSM": "LG",
    "SNY": "Sony",
    "PHL": "Philips",
    "VSC": "ViewSonic",
    "BNQ": "BenQ",
    "AOC": "AOC",
    "EIZ": "EIZO",
    "ENC": "EIZO",

    "HWP": "HP",
    "HPN": "HP",
    "HPQ": "HP",
    "HPC": "HP",
    "HPD": "HP",

    "CND": "MSI",
    "GBT": "Gigabyte",

    "LGD": "LG Display",
    "AUO": "AUO",
    "BOE": "BOE",
    "CMN": "Innolux",
    "CMO": "Innolux",
    "HSD": "HannStar",
    "HSP": "HannStar"
};

function getMonitorFriendlyName(m : Gdk.Monitor) : string {
    // get_description gives ugly legal names like Samsung Electric Company
    // which make the UI hard to read and overflow, so make our own if we can
    
    const manu = m.get_manufacturer() ?? "";
    const friendlyManu = MONITOR_ALIASES[manu];
    // If the manufacturer isn't listed fall back
    if(manu && !friendlyManu) {
        const d = m.get_description();
        if(d) return d;
    }

    const model = m.get_model() ?? _g("Unknown Display");

    const builtName = `${friendlyManu} ${model}`.trim();
    if(builtName.length > 15) return builtName;

    const widthIn = m.get_width_mm() / 25.4;
    const heightIn = m.get_width_mm() / 25.4;
    if(widthIn <= 0.0 || heightIn <= 0.0) return builtName;

    const diagonal = Math.round(Math.hypot(widthIn, heightIn));
    return `${builtName} (${diagonal}")`;
}

export function listMonitors() : MonitorOption[] {
    const options : MonitorOption[] = [ ];
    const modelStrs : Record<string, boolean> = { };

    const display = Gdk.Display.get_default();
    if(!display) return options;

    const monitors = display.get_monitors();
    for(let i = 0; i < monitors.get_n_items(); i++) {
        const monitor = monitors.get_item(i) as Gdk.Monitor | null;
        if(!monitor) continue;

        const manufacturer = monitor.get_manufacturer() ?? "";
        const model = monitor.get_model() ?? "";
        const widthmm = monitor.get_width_mm();
        const heightmm = monitor.get_height_mm();
        const connector = monitor.get_connector() ?? "";

        const modelStr = `${manufacturer}-${model}-${widthmm}-${heightmm}`;
        // If there was a duplicate monitor, just display the connector
        let label : string;
        if(modelStrs[modelStr]) label = connector;
        else {
            label = getMonitorFriendlyName(monitor);
            modelStrs[modelStr] = true;
        }

        options.push({
            label,
            fingerprint: {
                manufacturer, model, widthmm, heightmm, connector
            }
        });
    }

    return options;
}
