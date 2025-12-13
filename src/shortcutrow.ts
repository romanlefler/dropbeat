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
import Gdk from "gi://Gdk";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import { gettext as _g } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export interface ShortcutRowCtorProps extends Adw.ActionRow.ConstructorProps {
    value : string | null;
}

export type ValueChangedCallback = (newV : string | null, oldV : string | null) => void;

export class ShortcutRow extends Adw.ActionRow {
    static {
        GObject.registerClass(this);
    }

    #label : Gtk.ShortcutLabel;
    #controller : Gtk.EventControllerKey;

    #isListening : boolean = false;
    #value : string | null;

    #valueChangedCallbacks : ValueChangedCallback[] = [ ];

    constructor(props : Partial<ShortcutRowCtorProps> = {}) {
        const { value, ...rest } = props;
        super(rest);
        this.#value = value ?? null;

        this.#label = new Gtk.ShortcutLabel({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        this.add_suffix(this.#label);
        this.set_activatable_widget(this.#label);

        this.#controller = new Gtk.EventControllerKey();       
        this.#controller.connect("key-pressed", this.#controllerKeyPressed.bind(this));
        this.add_controller(this.#controller);

        this.connect("activated", () => {
            this.#startListening();
        });
        this.#updateLabel();
    }

    #startListening() : void {
        this.#isListening = true;
        
        this.#label.set_disabled_text(_g("Capturing..."));
        this.#label.set_accelerator("");

        this.grab_focus();
    }

    #updateLabel() : void {
        const v = this.#value;
        if(v) this.#label.set_accelerator(v);
        else {
            this.#label.set_disabled_text(_g("Unset"));
            this.#label.set_accelerator("");
        }
    }

    #controllerKeyPressed(controller : Gtk.EventControllerKey, keyval : number, keycode : number, state : Gdk.ModifierType) : boolean {
        if(!this.#isListening) return Gdk.EVENT_PROPAGATE;

        switch(keyval) {
            case Gdk.KEY_BackSpace:
                this.#value = null;
                // FALL THRU
            case Gdk.KEY_Escape:
                this.#isListening = false;
                this.#updateLabel();
                return Gdk.EVENT_STOP;
            case Gdk.KEY_Shift_L:
            case Gdk.KEY_Shift_R:
            case Gdk.KEY_Control_L:
            case Gdk.KEY_Control_R:
            case Gdk.KEY_Alt_L:
            case Gdk.KEY_Alt_R:
            case Gdk.KEY_Super_L:
            case Gdk.KEY_Super_R:
                // If only modifiers we wanna wait for a real key
                return Gdk.EVENT_STOP;
        }

        const mask = Gtk.accelerator_get_default_mod_mask() | Gdk.ModifierType.SUPER_MASK;
        const modsNorm = state & mask;
        const accel : string = Gtk.accelerator_name(keyval, modsNorm);

        const old = this.#value;
        this.#value = accel;
        this.#updateLabel();
        this.#isListening = false;

        this.#fireValueChangedCallbacks(this.#value, old);
        return Gdk.EVENT_STOP;
    }

    #fireValueChangedCallbacks(newV : string | null, oldV : string | null) : void {
        for(const c of this.#valueChangedCallbacks) c(newV, oldV);
    }

    getValue() : string | null {
        return this.#value;
    }

    setValue(v : string | null) {
        if(v === this.#value) return;

        if(!v) v = null;
        const old = this.#value;
        this.#value = v;

        this.#fireValueChangedCallbacks(this.#value, old);
        this.#updateLabel();
    }

    getSuper() : boolean {
        return this.#value?.includes("<Super>") ?? false;
    }

    setSuper(includeSuper : boolean) : void {
        const v = this.#value;
        if(!v) return;

        if(this.getSuper() === includeSuper) return;

        const newV = includeSuper ? `<Super>${v}` : v.replace("<Super>", "");
        this.setValue(newV);
    }

    addValueChangedListener(callback : ValueChangedCallback) : void {
        this.#valueChangedCallbacks.push(callback);
    }
};

