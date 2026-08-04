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
import Gdk from "gi://Gdk";
import Adw from "gi://Adw";
import { gettext as _g } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { ShortcutRow } from "./shortcutrow.js";

function setVisibilites(value : boolean, ...widgets : Gtk.Widget[]) {
    for(let w of widgets) w.visible = value;
}

interface MonitorFingerprint {
    manufacturer : string;
    model : string;
    widthmm : number;
    heightmm : number;
}

interface MonitorOption {
    label : string;
    fingerprint : MonitorFingerprint;
}

function listMonitors() : MonitorOption[] {
    const options : MonitorOption[] = [];
    const display = Gdk.Display.get_default();
    if(!display) return options;

    const monitors = display.get_monitors();
    for(let i = 0; i < monitors.get_n_items(); i++) {
        const monitor = monitors.get_item(i) as Gdk.Monitor | null;
        if(!monitor) continue;

        const manufacturer = monitor.get_manufacturer() ?? "";
        const model = monitor.get_model() ?? _g("Unknown Display");
        const connector = monitor.get_connector() ?? _g("Unknown Connection");
        options.push({
            label: `${manufacturer} ${model}: ${connector}`.trim(),
            fingerprint: {
                manufacturer: manufacturer,
                model: monitor.get_model() ?? "",
                widthmm: monitor.get_width_mm(),
                heightmm: monitor.get_height_mm()
            }
        });
    }

    return options;
}

export class GeneralPage extends Adw.PreferencesPage {

    static {
        GObject.registerClass(this);
    }

    constructor(settings : Gio.Settings) {

        super({
            title: _g("General"),
            icon_name: "preferences-system-symbolic"
        });

        const keybindingsGroup = new Adw.PreferencesGroup({
            title: _g("Keybindings"),
            description: _g("Configure keyboard shortcuts")
        });
        const openMenuShortcut = new ShortcutRow({
            title: _g("Desktop Shortcut"),
            subtitle: _g("Desktop keyboard shortcut to open/close the card"),
            value: settings.get_strv("open-menu-keybinding")[0] || null
        });
        openMenuShortcut.addValueChangedListener((v : string | null) => {
            openMenuSuper.active = openMenuShortcut.getSuper();

            settings.set_strv("open-menu-keybinding", v ? [ v ] : [ ]);
            settings.apply();
        });

        const openMenuSuper = new Adw.SwitchRow({
            title: _g("Include Super Key?"),
            subtitle: _g("Insert Super key into above shortcut"),
            active: openMenuShortcut.getSuper()
        });
        openMenuSuper.connect("notify::active", (w : Adw.SwitchRow) => {
            openMenuShortcut.setSuper(w.active);
        });

        keybindingsGroup.add(openMenuShortcut);
        keybindingsGroup.add(openMenuSuper);

        const fullscreenGroup = new Adw.PreferencesGroup({
            title: _g("Fullscreen"),
            description: _g("Configure the fullscreen window")
        });
        const monitorOptions = listMonitors();
        const monitorLabels = [ _g("Auto"), ...monitorOptions.map(option => option.label) ];
        const monitorFingerprints = monitorOptions.map(option => option.fingerprint);

        let selectedMonitor = 0;
        const savedMonitor = settings.get_string("fullscreen-monitor");
        if(savedMonitor) {
            try {
                const saved = JSON.parse(savedMonitor) as MonitorFingerprint;
                const index = monitorFingerprints.findIndex(monitor =>
                    monitor.manufacturer === saved.manufacturer &&
                    monitor.model === saved.model &&
                    monitor.widthmm === saved.widthmm &&
                    monitor.heightmm === saved.heightmm
                );
                if(index >= 0) selectedMonitor = index + 1;
                else {
                    // This monitor doesn't exist anymore, reset to Auto
                    settings.set_string("fullscreen-monitor", "");
                    settings.apply();
                }
            } catch(e) {
                console.warn(`Invalid fullscreen monitor setting: ${e}`);
            }
        }

        const fullscreenMonitor = new Adw.ComboRow({
            title: _g("Monitor"),
            model: Gtk.StringList.new(monitorLabels),
            selected: selectedMonitor
        });
        fullscreenMonitor.connect("notify::selected", (w : Adw.ComboRow) => {
            const fingerprint = w.selected === 0
                ? ""
                : JSON.stringify(monitorFingerprints[w.selected - 1]);
            settings.set_string("fullscreen-monitor", fingerprint);
            settings.apply();
        });
        fullscreenGroup.add(fullscreenMonitor);

        const internetGroup = new Adw.PreferencesGroup({
            title: _g("Internet"),
            description: _g("Configure Internet permissions")
        })
        const useInternet = new Adw.SwitchRow({
            title: _g("Fetch Album Covers"),
            subtitle: _g("Allow fetching album covers over HTTP/HTTPS"),
            active: settings.get_boolean("album-cover-internet")
        });

        const httpsOnly = new Adw.SwitchRow({
            title: _g("HTTPS Only"),
            subtitle: _g("Block album cover connections over plain HTTP"),
            active: settings.get_boolean("https-only"),
            sensitive: useInternet.active
        });
        httpsOnly.connect("notify::active", (w : Adw.SwitchRow) => {
            settings.set_boolean("https-only", w.active);
            settings.apply();
        });
        const requestTimeout = new Adw.SpinRow({
            title: _g("Request Timeout"),
            subtitle: _g("Album cover request timeout in seconds"),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 86400,
                step_increment: 1,
                page_increment: 10,
                value: settings.get_double("request-timeout")
            }),
            digits: 1,
            numeric: true,
            sensitive: useInternet.active
        });
        requestTimeout.connect("notify::value", (w : Adw.SpinRow) => {
            settings.set_double("request-timeout", w.value);
            settings.apply();
        });
        useInternet.connect("notify::active", (w : Adw.SwitchRow) => {
            settings.set_boolean("album-cover-internet", w.active);
            settings.apply();

            httpsOnly.sensitive = w.active;
            requestTimeout.sensitive = w.active;
        });

        internetGroup.add(useInternet);
        internetGroup.add(httpsOnly);
        internetGroup.add(requestTimeout);

        this.add(keybindingsGroup);
        this.add(fullscreenGroup);
        this.add(internetGroup);
    }

}
