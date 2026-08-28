/*
 * CodeMirror 6 Plugin for DokuWiki
 *
 * This project is a substantially modified work based on the DokuWiki
 * CodeMirror plugin by Albert Gasset and contributors:
 * https://github.com/albertgasset/dokuwiki-plugin-codemirror
 *
 * Copyright (C) 2026 AlexDraconian for this file's original work and modifications.
 * Modified 2026-08-28 for the CodeMirror 6 migration.
 * Licensed under the GNU General Public License, version 2 or later.
 * See LICENSE in the project root.
 */
import { Compartment, type Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/**
 * The configuration groups that are allowed to change while an editor is
 * alive. Keeping these compartments per editor prevents one textarea from
 * reconfiguring another editor instance.
 */
export interface EditorCompartments {
    readonly language: Compartment;
    readonly layout: Compartment;
    readonly editability: Compartment;
    readonly behavior: Compartment;
    readonly display: Compartment;
    readonly theme: Compartment;
    readonly keymap: Compartment;
    readonly scrollbar: Compartment;
}

export type EditorCompartmentName = keyof EditorCompartments;

export function createEditorCompartments(): EditorCompartments {
    return {
        language: new Compartment(),
        layout: new Compartment(),
        editability: new Compartment(),
        behavior: new Compartment(),
        display: new Compartment(),
        theme: new Compartment(),
        keymap: new Compartment(),
        scrollbar: new Compartment(),
    };
}

export function reconfigureEditor(
    view: EditorView,
    compartment: Compartment,
    extension: Extension,
): void {
    view.dispatch({effects: compartment.reconfigure(extension)});
}
