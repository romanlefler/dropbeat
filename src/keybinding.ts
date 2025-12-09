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
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

const KEY_OPEN_MENU = "open-menu-keybinding";

let isBinded : boolean = false;

export function keybindingSetup(
    settings : Gio.Settings,
    openMenuHandler : () => void
) {
    if(isBinded) keybindingCleanup();

    Main.wm.addKeybinding(
        KEY_OPEN_MENU,
        settings,
        Meta.KeyBindingFlags.NONE,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => openMenuHandler()
    );
    isBinded = true;
}

export function keybindingCleanup() {
    if(!isBinded) return;
    Main.wm.removeKeybinding(KEY_OPEN_MENU);
    isBinded = false;
}

