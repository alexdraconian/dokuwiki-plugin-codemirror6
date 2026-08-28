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
import { EditorSelection, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import {
    createEditor,
    type CreateEditorOptions,
    type EditorController,
} from "./create-editor";

export interface TextareaAdapterOptions {
    readonly textarea: HTMLTextAreaElement;
    readonly form?: HTMLFormElement | null;
    readonly lineWrapping?: boolean;
    readonly readOnly?: boolean;
    readonly tabSize?: number;
    readonly height?: string | null;
    readonly autoHeight?: boolean;
    readonly className?: string;
    readonly syncOnSubmit?: () => boolean;
    readonly createEditor?: (options: CreateEditorOptions) => EditorController;
    readonly extensions?: Extension;
    readonly onChange?: (value: string) => void;
}

export interface TextareaAdapter {
    readonly textarea: HTMLTextAreaElement;
    readonly host: HTMLDivElement;
    readonly editor: EditorController;
    syncToTextarea(): string;
    getValue(): string;
    setValue(value: string): void;
    getSelection(): ReturnType<EditorController["getSelection"]>;
    setSelection(selection: ReturnType<EditorController["getSelection"]>): void;
    destroy(): void;
}

interface TextareaSelection {
    readonly start: number;
    readonly end: number;
    readonly direction: "forward" | "backward" | "none";
}

interface TextareaSnapshot {
    readonly display: string;
    readonly selection: TextareaSelection;
    readonly focused: boolean;
}

const mountedAdapters = new WeakMap<HTMLTextAreaElement, TextareaAdapter>();

function readSelection(textarea: HTMLTextAreaElement): TextareaSelection {
    return {
        start: textarea.selectionStart ?? 0,
        end: textarea.selectionEnd ?? 0,
        direction: textarea.selectionDirection === "backward" ? "backward" :
            textarea.selectionDirection === "forward" ? "forward" : "none",
    };
}

function selectionFromTextarea(textarea: HTMLTextAreaElement): EditorSelection {
    const selection = readSelection(textarea);
    return EditorSelection.single(selection.start, selection.end);
}

function heightFor(textarea: HTMLTextAreaElement, options: TextareaAdapterOptions): string | null {
    if (options.autoHeight) {
        return "auto";
    }
    if (options.height !== undefined) {
        return options.height;
    }
    if (textarea.style.height) {
        return textarea.style.height;
    }
    const view = textarea.ownerDocument.defaultView;
    const computedHeight = view ? view.getComputedStyle(textarea).height : "";
    return computedHeight && computedHeight !== "auto" && computedHeight !== "0px" ?
        computedHeight : null;
}

function restoreSelection(textarea: HTMLTextAreaElement, selection: TextareaSelection): void {
    try {
        textarea.setSelectionRange(selection.start, selection.end, selection.direction);
    } catch (_error) {
        // Some non-browser DOM implementations do not expose selection APIs.
    }
}

export function getMountedTextAreaAdapter(
    textarea: HTMLTextAreaElement,
): TextareaAdapter | undefined {
    return mountedAdapters.get(textarea);
}

export function mountTextArea(options: TextareaAdapterOptions): TextareaAdapter {
    const existing = mountedAdapters.get(options.textarea);
    if (existing) {
        return existing;
    }

    const textarea = options.textarea;
    const parent = textarea.parentNode;
    if (!parent) {
        throw new Error("Cannot mount an editor for a detached textarea");
    }

    const snapshot: TextareaSnapshot = {
        display: textarea.style.display,
        selection: readSelection(textarea),
        focused: textarea.ownerDocument.activeElement === textarea,
    };
    const host = textarea.ownerDocument.createElement("div");
    host.className = options.className || "cm6-editor-host";
    host.dataset.codemirror6 = "textarea-adapter";
    const height = heightFor(textarea, options);
    if (height) {
        host.style.height = height;
    }
    parent.insertBefore(host, textarea);
    textarea.style.display = "none";

    let editor: EditorController;
    try {
        const makeEditor = options.createEditor ?? createEditor;
        editor = makeEditor({
            parent: host,
            root: textarea.ownerDocument,
            doc: textarea.value,
            selection: selectionFromTextarea(textarea),
            lineWrapping: options.lineWrapping ?? textarea.wrap !== "off",
            readOnly: options.readOnly ?? textarea.readOnly,
            tabSize: options.tabSize ?? 8,
            extensions: [
                options.extensions ?? [],
                options.onChange ? EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        options.onChange?.(update.state.doc.toString());
                    }
                }) : [],
            ],
        });
    } catch (error) {
        textarea.style.display = snapshot.display;
        host.remove();
        throw error;
    }

    const form = options.form === undefined ? textarea.form : options.form;
    let destroyed = false;
    const syncToTextarea = (): string => {
        if (destroyed) {
            return textarea.value;
        }
        const value = editor.getValue();
        textarea.value = value;
        return value;
    };
    const onSubmit = (): void => {
        if (options.syncOnSubmit?.() === false) {
            return;
        }
        syncToTextarea();
    };
    if (form) {
        form.addEventListener("submit", onSubmit, true);
    }

    const adapter: TextareaAdapter = {
        textarea,
        host,
        editor,
        syncToTextarea,
        getValue(): string {
            return editor.getValue();
        },
        setValue(value: string): void {
            editor.setValue(value);
        },
        getSelection(): ReturnType<EditorController["getSelection"]> {
            return editor.getSelection();
        },
        setSelection(selection: ReturnType<EditorController["getSelection"]>): void {
            editor.setSelection(selection);
        },
        destroy(): void {
            if (destroyed) {
                return;
            }
            const editorSelection = editor.getSelection().main;
            const shouldFocusTextarea = editor.view.hasFocus || snapshot.focused;
            syncToTextarea();
            editor.destroy();
            if (form) {
                form.removeEventListener("submit", onSubmit, true);
            }
            host.remove();
            textarea.style.display = snapshot.display;
            restoreSelection(textarea, {
                start: editorSelection.from,
                end: editorSelection.to,
                direction: editorSelection.anchor <= editorSelection.head ? "forward" : "backward",
            });
            if (shouldFocusTextarea) {
                textarea.focus();
            }
            destroyed = true;
            mountedAdapters.delete(textarea);
        },
    };

    mountedAdapters.set(textarea, adapter);
    return adapter;
}
