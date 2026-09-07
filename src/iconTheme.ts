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
    along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

import Gio from "gi://Gio";
import GLib from "gi://GLib";

interface IconDirectory {
    paths : string[];
    scale : number;
    minSize : number;
    maxSize : number;
}

interface Theme {
    directories : IconDirectory[];
    inherits : string[];
}

function isName(name : string) : boolean {
    return name.length > 0 && name !== "." && name !== ".."
        && !name.includes("/") && !name.includes("\0");
}

function getList(index : GLib.KeyFile, key : string) : string[] {
    try {
        return index.get_string("Icon Theme", key).split(",")
            .map(value => value.trim()).filter(Boolean);
    } catch {
        return [ ];
    }
}

function getInteger(index : GLib.KeyFile, group : string, key : string, fallback : number) : number {
    try {
        return index.get_integer(group, key);
    } catch {
        return fallback;
    }
}

/** Resolves files without changing the icon theme used by GNOME Shell. */
export class IconThemeResolver {
    readonly #themeName : string;
    readonly #roots : string[];
    readonly #themes = new Map<string, Theme | null>();
    readonly #lookups = new Map<string, string | null>();

    constructor(themeName : string) {
        this.#themeName = themeName;
        this.#roots = [...new Set([
            GLib.build_filenamev([GLib.get_user_data_dir(), "icons"]),
            GLib.build_filenamev([GLib.get_home_dir(), ".icons"]),
            ...GLib.get_system_data_dirs().map(dir => GLib.build_filenamev([dir, "icons"])),
        ].map(dir => GLib.canonicalize_filename(dir, null)))];
    }

    lookup(iconName : string, size : number, scale = 1) : string | null {
        if(!isName(iconName) || !Number.isFinite(size) || size <= 0
            || !Number.isInteger(scale) || scale <= 0) return null;

        const key = JSON.stringify([iconName, size, scale]);
        if(this.#lookups.has(key)) return this.#lookups.get(key)!;

        let result : string | null = null;
        // A removed or invalid selection leaves the popup's normal icon intact.
        if(this.#getTheme(this.#themeName)) {
            const names = iconName.endsWith("-symbolic")
                ? [iconName, iconName.slice(0, -"-symbolic".length)] : [iconName];
            const visited = new Set<string>();
            result = this.#findInTheme(this.#themeName, names, size, scale, visited)
                ?? this.#findInTheme("hicolor", names, size, scale, visited);
        }
        this.#lookups.set(key, result);
        return result;
    }

    #getTheme(name : string) : Theme | null {
        if(!isName(name)) return null;
        if(this.#themes.has(name)) return this.#themes.get(name)!;
        this.#themes.set(name, null);

        let index : GLib.KeyFile | null = null;
        for(const root of this.#roots) {
            try {
                const candidate = new GLib.KeyFile();
                candidate.load_from_file(
                    GLib.build_filenamev([root, name, "index.theme"]), GLib.KeyFileFlags.NONE
                );
                index = candidate;
                break;
            } catch {
                // Themes can be installed in only some of the search paths.
            }
        }
        if(!index) return null;

        try {
            const [keys] = index.get_keys("Icon Theme");
            if(!keys.includes("Directories") && !keys.includes("ScaledDirectories")) return null;
        } catch {
            return null;
        }

        const directories : IconDirectory[] = [ ];
        const names = new Set([...getList(index, "Directories"), ...getList(index, "ScaledDirectories")]);
        for(const directory of names) {
            if(!directory.split("/").every(isName)) continue;
            const size = getInteger(index, directory, "Size", 0);
            const scale = getInteger(index, directory, "Scale", 1);
            if(size <= 0 || scale <= 0) continue;
            let type = "Threshold";
            try {
                type = index.get_string(directory, "Type");
            } catch {
                // Threshold is the icon theme specification's default type.
            }
            let minSize = size;
            let maxSize = size;
            if(type === "Scalable") {
                minSize = getInteger(index, directory, "MinSize", size);
                maxSize = getInteger(index, directory, "MaxSize", size);
            } else if(type === "Threshold") {
                const threshold = Math.max(0, getInteger(index, directory, "Threshold", 2));
                minSize = Math.max(0, size - threshold);
                maxSize = size + threshold;
            } else if(type !== "Fixed") {
                continue;
            }
            if(minSize < 0 || maxSize < minSize) continue;
            // Cache existing locations, including overlays without an index.theme.
            const paths = this.#roots.map(root => GLib.build_filenamev([root, name, directory]))
                .filter(path => GLib.file_test(path, GLib.FileTest.IS_DIR));
            if(paths.length) directories.push({ paths, scale, minSize, maxSize });
        }

        const theme = { directories, inherits: getList(index, "Inherits").filter(isName) };
        this.#themes.set(name, theme);
        return theme;
    }

    #findInTheme(
        themeName : string, names : string[], size : number, scale : number, visited : Set<string>
    ) : string | null {
        if(visited.has(themeName)) return null;
        visited.add(themeName);
        const theme = this.#getTheme(themeName);
        if(!theme) return null;

        // Exact logical size/scale matches precede the nearest physical size.
        const directories = theme.directories.map(directory => ({
            directory,
            exact: directory.scale === scale && size >= directory.minSize && size <= directory.maxSize,
            distance: Math.max(
                directory.minSize * directory.scale - size * scale,
                size * scale - directory.maxSize * directory.scale,
                0
            ),
        })).sort((a, b) => Number(b.exact) - Number(a.exact) || a.distance - b.distance);

        // Prefer the selected theme's regular icon to a parent's symbolic icon.
        for(const name of names) {
            const extensions = name.endsWith("-symbolic")
                ? [".symbolic.png", ".png", ".svg", ".xpm"] : [".png", ".svg", ".xpm"];
            for(const { directory } of directories) {
                for(const directoryPath of directory.paths) {
                    for(const extension of extensions) {
                        const path = GLib.build_filenamev([directoryPath, name + extension]);
                        if(!GLib.file_test(path, GLib.FileTest.IS_REGULAR)) continue;
                        try {
                            const info = Gio.File.new_for_path(path).query_info(
                                "standard::type,access::can-read", Gio.FileQueryInfoFlags.NONE, null
                            );
                            if(info.get_file_type() === Gio.FileType.REGULAR
                                && info.get_attribute_boolean("access::can-read")) return path;
                        } catch {
                            // Missing, unreadable and broken symlink candidates are skipped.
                        }
                    }
                }
            }
        }
        for(const parent of theme.inherits) {
            const path = this.#findInTheme(parent, names, size, scale, visited);
            if(path) return path;
        }
        return null;
    }
}
