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

import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import { ExtensionMetadata } from "resource:///org/gnome/shell/extensions/extension.js";
import { gettext as _g } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
// @ts-ignore
import { PACKAGE_VERSION } from "resource:///org/gnome/Shell/Extensions/js/misc/config.js";

function md(s : string, classes? : string[]) : Gtk.Label {
    const props : Partial<Gtk.Label.ConstructorProps> = {
        label: s,
        use_markup: true,
        css_classes: [ "simpleweather-margin" ]
    };
    if(classes) props.css_classes = classes;
    return new Gtk.Label(props);
}

export class AboutPage extends Adw.PreferencesPage {

    static {
        GObject.registerClass(this);
    }

    constructor(settings : Gio.Settings, metadata : ExtensionMetadata, window : Adw.PreferencesWindow) {

        super({
            title: _g("About"),
            icon_name: "help-about-symbolic"
        });

        const topGroup = new Adw.PreferencesGroup();
        const topBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });
        topBox.append(md("Dropbeat for GNOME", [ "dropbeat-h1" ]));
        topBox.append(md("Roman Lefler", [ "dropbeat-h2" ]));
        topBox.append(md(
            `<a href=\"https://github.com/romanlefler/dropbeat\">${_g("GitHub Repository")}</a>` +
            " | " +
            `<a href=\"https://ko-fi.com/romanlefler\">${_g("Support Me")}</a>`,
        ));
        topGroup.add(topBox);
        this.add(topGroup);

        const infoGroup = new Adw.PreferencesGroup();
        const versionRow = new Adw.ActionRow({
            title: _g("Dropbeat Version")
        });
        versionRow.add_suffix(new Gtk.Label({
            label: metadata["version-name"] ?? _g("Unknown")
        }));
        infoGroup.add(versionRow);

        const settingsRow = new Adw.ActionRow({
            title: _g("Settings")
        });
        const settingsBtnContent = new Adw.ButtonContent({
            label: _g("Copy"),
            icon_name: "edit-copy-symbolic"
        });
        const settingsButton = new Gtk.Button({
            child: settingsBtnContent
        });
        settingsButton.connect("clicked", () => {
            const keys : string[] = settings.settings_schema.list_keys();

            const obj : Record<string, string> = { };
            for(let k of keys) {
                const val = settings.get_user_value(k);
                if(val === null) continue;
                obj[k] = val.print(false);
            }
            obj["app-version"] = metadata["version-name"] ?? "Unknown";
            obj["gnome-version"] = PACKAGE_VERSION;
            settingsBtnContent.icon_name = "checkbox";
            settingsButton.get_clipboard().set(JSON.stringify(obj));

            let toast = new Adw.Toast({
                title: _g("Copied settings JSON to clipboard.")
            });
            window.add_toast(toast);
        });
        settingsRow.add_suffix(settingsButton);
        infoGroup.add(settingsRow);
        this.add(infoGroup);

        const bottomGroup = new Adw.PreferencesGroup();
        const bottomBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });
        const repoLink = "<a href=\"https://github.com/romanlefler/dropbeat\">GitHub</a>";
        bottomBox.append(md(
            _g("Contributions and translations are welcome! Read how on %s.").format(repoLink)
        ));
        bottomBox.append(md(
            _g("If you like this extension, consider starring it on %s.").format("GitHub")
        ));
        const issuesLink = "<a href= \"https://github.com/romanlefler/dropbeat/issues/new/choose\">" +
            _g("here") + "</a>";
        bottomBox.append(md(
            _g("Report bugs or request new features %s.").format(issuesLink)
        ));
        bottomGroup.add(bottomBox);
        this.add(bottomGroup);
    }

}

