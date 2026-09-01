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
import { history } from "@codemirror/commands";
import { search } from "@codemirror/search";
import {
    Compartment,
    EditorSelection,
    EditorState,
    type Extension,
} from "@codemirror/state";
import {
    EditorView,
    type EditorViewConfig,
} from "@codemirror/view";

import {
    createEditorCompartments,
    reconfigureEditor,
    type EditorCompartments,
} from "./compartments";
import {dokuWikiDefaultTheme} from "./themes";

export interface CreateEditorOptions {
    readonly parent: Element | DocumentFragment;
    readonly root?: Document | ShadowRoot;
    readonly doc?: string;
    readonly selection?: EditorSelection;
    readonly lineWrapping?: boolean;
    readonly readOnly?: boolean;
    readonly tabSize?: number;
    readonly allowMultipleSelections?: boolean;
    readonly extensions?: Extension;
    readonly viewFactory?: (config: EditorViewConfig) => EditorView;
}

export interface EditorController {
    readonly view: EditorView;
    readonly compartments: EditorCompartments;
    getValue(): string;
    setValue(value: string): void;
    getSelection(): EditorSelection;
    setSelection(selection: EditorSelection): void;
    reconfigure(compartment: Compartment, extension: Extension): void;
    setLineWrapping(enabled: boolean): void;
    setReadOnly(readOnly: boolean): void;
    destroy(): void;
}

function validTabSize(value: number | undefined): number {
    return Number.isInteger(value) && (value as number) > 0 ? value as number : 2;
}

function clamp(value: number, length: number): number {
    return Math.max(0, Math.min(length, value));
}

function clampSelection(selection: EditorSelection, length: number): EditorSelection {
    const ranges = selection.ranges.map((range) => EditorSelection.range(
        clamp(range.anchor, length),
        clamp(range.head, length),
        range.goalColumn ?? undefined,
        range.bidiLevel ?? undefined,
        range.assoc,
    ));

    return EditorSelection.create(
        ranges,
        Math.min(selection.mainIndex, Math.max(0, ranges.length - 1)),
    );
}

function editability(readOnly: boolean): Extension {
    return [
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
    ];
}

function layout(lineWrapping: boolean): Extension {
    return lineWrapping ? EditorView.lineWrapping : [];
}

export function createEditor(options: CreateEditorOptions): EditorController {
    const compartments = createEditorCompartments();
    const doc = options.doc ?? "";
    const readOnly = options.readOnly ?? false;
    const lineWrapping = options.lineWrapping ?? false;
    const tabSize = validTabSize(options.tabSize);
    const selection = options.selection
        ? clampSelection(options.selection, doc.length)
        : undefined;
    const state = EditorState.create({
        doc,
        selection,
        extensions: [
            history(),
            search(),
            EditorState.allowMultipleSelections.of(
                options.allowMultipleSelections ?? true,
            ),
            compartments.tabSize.of(EditorState.tabSize.of(tabSize)),
            compartments.language.of([]),
            compartments.layout.of(layout(lineWrapping)),
            compartments.editability.of(editability(readOnly)),
            compartments.behavior.of([]),
            compartments.display.of([]),
            compartments.theme.of(dokuWikiDefaultTheme),
            compartments.keymap.of([]),
            compartments.scrollbar.of([]),
            options.extensions ?? [],
        ],
    });
    const createView = options.viewFactory ?? ((config: EditorViewConfig) => (
        new EditorView(config)
    ));
    const view = createView({
        state,
        parent: options.parent,
        root: options.root,
    });
    let destroyed = false;

    function assertActive(): void {
        if (destroyed) {
            throw new Error("The editor controller has been destroyed");
        }
    }

    return {
        view,
        compartments,
        getValue(): string {
            assertActive();
            return view.state.doc.toString();
        },
        setValue(value: string): void {
            assertActive();
            view.dispatch({
                changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: value,
                },
            });
        },
        getSelection(): EditorSelection {
            assertActive();
            return view.state.selection;
        },
        setSelection(nextSelection: EditorSelection): void {
            assertActive();
            view.dispatch({
                selection: clampSelection(nextSelection, view.state.doc.length),
            });
        },
        reconfigure(compartment: Compartment, extension: Extension): void {
            assertActive();
            reconfigureEditor(view, compartment, extension);
        },
        setLineWrapping(enabled: boolean): void {
            assertActive();
            reconfigureEditor(view, compartments.layout, layout(enabled));
        },
        setReadOnly(nextReadOnly: boolean): void {
            assertActive();
            reconfigureEditor(view, compartments.editability, editability(nextReadOnly));
        },
        destroy(): void {
            if (destroyed) {
                return;
            }
            destroyed = true;
            view.destroy();
        },
    };
}
