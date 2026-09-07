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
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";

export interface IconThemeOption {
    name : string;
    label : string;
}

export function listIconThemes() : IconThemeOption[] {
    const options : IconThemeOption[] = [ ];
    const display = Gdk.Display.get_default();
    const iconTheme = display ? Gtk.IconTheme.get_for_display(display) : new Gtk.IconTheme();
    const searchPaths = iconTheme.get_search_path() ?? [ ];
    const seen = new Set<string>();

    for(const path of searchPaths) {
        const directory = Gio.File.new_for_path(path);
        let enumerator : Gio.FileEnumerator | null = null;
        try {
            enumerator = directory.enumerate_children(
                "standard::name,standard::type",
                Gio.FileQueryInfoFlags.NONE,
                null
            );
            let info : Gio.FileInfo | null;
            while((info = enumerator.next_file(null)) !== null) {
                if(info.get_file_type() !== Gio.FileType.DIRECTORY) continue;
                const name = info.get_name();
                if(seen.has(name)) continue;

                try {
                    const index = new GLib.KeyFile();
                    index.load_from_file(
                        GLib.build_filenamev([path, name, "index.theme"]),
                        GLib.KeyFileFlags.NONE
                    );
                    // The first index.theme in GTK's search order takes precedence.
                    seen.add(name);
                    const [keys] = index.get_keys("Icon Theme");
                    if(keys.includes("Hidden") && index.get_boolean("Icon Theme", "Hidden")) continue;
                    // Cursor themes also use index.theme, but do not list icon directories.
                    if(!keys.includes("Directories") && !keys.includes("ScaledDirectories")) continue;

                    const label = keys.includes("Name")
                        ? index.get_locale_string("Icon Theme", "Name", null) || name
                        : name;
                    options.push({ name, label });
                } catch {
                    // Ignore directories without a readable, valid icon theme index.
                }
            }
        } catch {
            // Search paths may not exist or may be unreadable.
        } finally {
            try {
                enumerator?.close(null);
            } catch {
                // A disappearing directory should not prevent opening preferences.
            }
        }
    }

    return options.sort((a, b) => a.label.localeCompare(b.label) || a.name.localeCompare(b.name));
}
