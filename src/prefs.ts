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

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";

import { ExtensionMetadata } from "resource:///org/gnome/shell/extensions/extension.js";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { GeneralPage } from "./preferences/generalPage.js";
import { AboutPage } from "./preferences/aboutPage.js";
import { gettext as _g } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class SimpleWeatherPreferences extends ExtensionPreferences {

    readonly #metadata : ExtensionMetadata;

    constructor(metadata : ExtensionMetadata) {
        super(metadata);
        this.#metadata = metadata;
    }

    async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings();
        settings.delay();

        const gdkDisplay = Gdk.Display.get_default();
        if(!gdkDisplay) throw new Error("No GDK display detected.");
        const cssProv = new Gtk.CssProvider();
        const cssFile = this.#metadata.dir.get_child("prefs.css");
        cssProv.load_from_file(cssFile);
        Gtk.StyleContext.add_provider_for_display(
            gdkDisplay,
            cssProv,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        window.add(new GeneralPage(settings));
        window.add(new AboutPage(settings, this.#metadata, window));

    }
}
