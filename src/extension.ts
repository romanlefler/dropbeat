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
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { gettext as extensionGettext } from "resource:///org/gnome/shell/extensions/extension.js";
import { setUpGettext } from "./gettext.js";
import { setBusSession, mediaFree, mediaLaunched, getMediaPlayers, isWebBrowser, mediaQueryPlayer, mediaTogglePause, mediaPrev, mediaNext, mediaSeek, mediaRaise } from "./mpris.js";
import { Popup } from "./popup.js";
import { setUpSoup, freeSoup, setSoupTimeout } from "./soup.js";
import { keybindingSetup, keybindingCleanup } from "./keybinding.js";
import { WndBus } from "./wndbus.js";
import { ensureMagick } from "./prereqs.js";

export default class DropbeatExtension extends Extension {

    #gsettings! : Gio.Settings;
    #popup? : Popup;
    #indicator? : PanelMenu.Button;
    #panelIcon? : St.Icon;
    #wndBus? : WndBus;
    #currentPlayer : string | null = null;

    #settingsHandler : number | undefined;
    #timeoutSettingsHandler : number | undefined;

    /**
     * Called by GNOME Extensions when this extension is enabled.
     * This is the entry point.
     */
    enable() : void {
        this.#gsettings = this.getSettings();

        setUpGettext(extensionGettext);
        setUpSoup();
        setSoupTimeout(this.#gsettings.get_double("request-timeout"));
        this.#timeoutSettingsHandler = this.#gsettings.connect(
            "changed::request-timeout",
            settings => setSoupTimeout(settings.get_double("request-timeout"))
        );

        this.#wndBus = new WndBus(this);
        setBusSession(Gio.DBus.session);
        keybindingSetup(
            this.#gsettings,
            this.#openMenuKeybind.bind(this)
        );

        this.#enableAsync().catch(err => {
            console.error(`Error when enabling Dropbeat: ${err}`);
        });
    }

    async #pickArbitraryPlayer() : Promise<string | null> {
        const players = await getMediaPlayers();
        return players.find(name => !this.#isPlayerHidden(name)) ?? null;
    }

    #isPlayerHidden(name : string) : boolean {
        return this.#gsettings.get_boolean("hide-browsers") && isWebBrowser(name);
    }

    async #refreshPlayerSelection() : Promise<void> {
        const player = await this.#pickArbitraryPlayer();
        if(player) this.#mediaChanged(player);
        else {
            this.#currentPlayer = null;
            this.#destroyIndicator();
        }
    }

    async #enableAsync() : Promise<void> {
        const hasMagick = await ensureMagick(this.#gsettings);
        if(!hasMagick) {
            console.error("Dropbeat: ImageMagick not found; disabling.");
            this.disable();
            return;
        }

        await mediaLaunched(name => {
            if(this.#isPlayerHidden(name)) return;
            this.#mediaChanged(name);
        }, name => {
            if(name === this.#currentPlayer) this.#refreshPlayerSelection();
        }, name => {
            if(this.#isPlayerHidden(name)) return;
            this.#mediaChanged(name);
        });

        const player = await this.#pickArbitraryPlayer();
        if(player) this.#mediaChanged(player);

        this.#settingsHandler = this.#gsettings.connect("changed", (_, k) => {
            if(k === "open-menu-keybinding") {
                keybindingCleanup();
                keybindingSetup(this.#gsettings, this.#openMenuKeybind.bind(this));
            } else if(k === "hide-browsers") {
                if(
                    !this.#currentPlayer ||
                    (this.#gsettings.get_boolean("hide-browsers") && isWebBrowser(this.#currentPlayer))
                ) this.#refreshPlayerSelection();
            }
        });
    }

    #openMenuKeybind() : void {
        this.#indicator?.menu.toggle();
    }

    /**
     * Called by GNOME Extensions when this extension is disabled.
     */
    disable() : void {
        if(this.#timeoutSettingsHandler !== undefined) {
            this.#gsettings.disconnect(this.#timeoutSettingsHandler);
            this.#timeoutSettingsHandler = undefined;
        }
        if(this.#settingsHandler !== undefined) {
            this.#gsettings.disconnect(this.#settingsHandler);
            this.#settingsHandler = undefined;
        }
        this.#wndBus?.free();
        this.#wndBus = undefined;
        this.#currentPlayer = null;
        freeSoup();
        mediaFree();
        keybindingCleanup();

        this.#destroyIndicator();
        // This is all redundant but done for Shexli/review process {
        this.#popup?.free();
        this.#popup = undefined;
        this.#panelIcon = undefined;
        this.#indicator?.destroy();
        this.#indicator = undefined;
        // }

        this.#gsettings = undefined!;
    }

    #createIndicator() : void {
        const indic = new PanelMenu.Button(0, "Dropbeat", false);
        const layout = new St.BoxLayout({
            vertical: false
        });

        this.#panelIcon = new St.Icon({
            icon_name: "folder-music-symbolic",
            style_class: "system-status-icon"
        });

        layout.add_child(this.#panelIcon);
        indic.add_child(layout);

        this.#popup?.free();
        if(indic.menu instanceof PopupMenu.PopupMenu) {
            if(!this.#wndBus) throw new Error("Dropbeat: WndBus is undefined in createIndicator.");
            this.#popup = new Popup({
                menu: indic.menu,
                metadata: this.metadata,
                wndBus: this.#wndBus,
                gSettings: this.#gsettings,
                mediaTogglePause,
                mediaPrev,
                mediaNext,
                mediaSeek,
                mediaRaise
            });
        } else this.#popup = undefined;

        this.#indicator?.destroy();
        this.#indicator = indic;
        Main.panel.addToStatusArea(this.uuid, this.#indicator!, 0, "right");
    }

    #destroyIndicator() : void {
        this.#popup?.free();
        this.#popup = undefined;
        this.#panelIcon = undefined;
        this.#indicator?.destroy();
        this.#indicator = undefined;
    }

    #mediaChanged(name : string) : void {
        if(this.#isPlayerHidden(name)) return;
        const info = mediaQueryPlayer(name);

        if(!info) {
            if(name === this.#currentPlayer) {
                this.#currentPlayer = null;
                this.#destroyIndicator();
            }
            return;
        }
        if(!this.#indicator) this.#createIndicator();

        this.#currentPlayer = name;
        this.#popup?.updateGui(name, info);
    }

}
