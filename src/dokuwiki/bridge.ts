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
import { type EditorView } from "@codemirror/view";

import {
    mountTextArea,
    type TextareaAdapter,
    type TextareaAdapterOptions,
} from "../editor/textarea-adapter";
import { createDokuWikiKeymap, type IsOuterMode } from "./commands";
import { createLockTimerSync, type LockTimer } from "./lock-timer";
import {
    orderedSelection,
    type AbsoluteSelection,
    type DokuWikiSelection,
} from "./selection";
import { createToolbarPort, type ToolbarPort } from "./toolbar";
import {
    createEditorSettings,
    type EditorSettingsController,
    type EditorSettingsOptions,
} from "../editor/settings";

type DokuWikiFunction = (this: unknown, ...args: any[]) => any;
type DokuWikiSelectionClass = DokuWikiFunction;

export interface DokuWikiEditorGlobal {
    setWrap?: DokuWikiFunction;
    sizeCtl?: DokuWikiFunction;
}

export interface DokuWikiWindow extends Window {
    dw_editor?: DokuWikiEditorGlobal;
    currentHeadlineLevel?: DokuWikiFunction;
    selection_class?: DokuWikiSelectionClass;
    DWgetSelection?: DokuWikiFunction;
    DWsetSelection?: DokuWikiFunction;
    pasteText?: DokuWikiFunction;
}

export interface DokuWikiEditorPort {
    readValue(): string;
    writeValue(value: string): void;
    getSelection(): AbsoluteSelection;
    setSelection(selection: AbsoluteSelection): void;
    getText(start: number, end: number): string;
    replaceText(start: number, end: number, text: string): void;
    focus(): void;
    syncForSubmit(): void;
    isTargetTextarea(value: unknown): boolean;
    setLineWrapping?(enabled: boolean): void;
    refreshLayout?(): void;
}

export interface DokuWikiBridgeOptions {
    readonly window: DokuWikiWindow;
    readonly editor: DokuWikiEditorPort;
    readonly lockTimer?: LockTimer;
    readonly now?: () => Date;
    readonly isOuterMode?: IsOuterMode;
    readonly isActive?: () => boolean;
}

export interface DokuWikiBridge {
    readonly toolbar: ToolbarPort;
    uninstall(): void;
    destroy(): void;
}

interface PropertySnapshot {
    readonly target: object;
    readonly key: PropertyKey;
    readonly descriptor: PropertyDescriptor | undefined;
}

function takeSnapshot(target: object, key: PropertyKey): PropertySnapshot {
    return {target, key, descriptor: Object.getOwnPropertyDescriptor(target, key)};
}

function restore(snapshot: PropertySnapshot): void {
    if (snapshot.descriptor) {
        Object.defineProperty(snapshot.target, snapshot.key, snapshot.descriptor);
    } else {
        delete (snapshot.target as Record<PropertyKey, unknown>)[snapshot.key];
    }
}

function callOriginal(
    fn: DokuWikiFunction | undefined,
    receiver: unknown,
    args: any[],
): any {
    return fn ? fn.apply(receiver, args) : undefined;
}

function selectionValues(selection: DokuWikiSelection): AbsoluteSelection {
    return orderedSelection({
        start: Number.isFinite(selection.start) ? selection.start : 0,
        end: Number.isFinite(selection.end) ? selection.end : 0,
    });
}

export function installDokuWikiBridge(
    options: DokuWikiBridgeOptions,
): DokuWikiBridge {
    const {window: dokuWindow, editor} = options;
    const isActive = options.isActive ?? (() => true);
    const dwEditor = dokuWindow.dw_editor ?? {};
    const createdDwEditor = !dokuWindow.dw_editor;
    if (createdDwEditor) {
        dokuWindow.dw_editor = dwEditor;
    }

    const snapshots = [
        takeSnapshot(dokuWindow, "currentHeadlineLevel"),
        takeSnapshot(dokuWindow, "selection_class"),
        takeSnapshot(dokuWindow, "DWgetSelection"),
        takeSnapshot(dokuWindow, "DWsetSelection"),
        takeSnapshot(dokuWindow, "pasteText"),
        takeSnapshot(dwEditor, "setWrap"),
        takeSnapshot(dwEditor, "sizeCtl"),
    ];
    const original = {
        currentHeadlineLevel: dokuWindow.currentHeadlineLevel,
        selectionClass: dokuWindow.selection_class,
        getSelection: dokuWindow.DWgetSelection ?? (
            (dokuWindow as unknown as {getSelection?: DokuWikiFunction}).getSelection
        ),
        setSelection: dokuWindow.DWsetSelection ?? (
            (dokuWindow as unknown as {setSelection?: DokuWikiFunction}).setSelection
        ),
        pasteText: dokuWindow.pasteText,
        setWrap: dwEditor.setWrap,
        sizeCtl: dwEditor.sizeCtl,
    };

    let uninstalled = false;
    const isTarget = (value: unknown): boolean => editor.isTargetTextarea(value);
    const saveSelectionText = (selection: DokuWikiSelection): string => {
        if (!isTarget(selection.obj)) {
            return original.selectionClass ? "" : "";
        }
        return editor.getText(selection.start, selection.end);
    };

    const selectionClass = function(this: unknown, ...args: any[]): any {
        let instance: DokuWikiSelection = this && typeof this === "object" ?
            this as DokuWikiSelection : {start: 0, end: 0};
        if (original.selectionClass) {
            try {
                original.selectionClass.apply(instance, args);
            } catch (_error) {
                const constructed = Reflect.construct(
                    original.selectionClass as unknown as Function,
                    args,
                );
                if (constructed && typeof constructed === "object") {
                    instance = constructed as DokuWikiSelection;
                }
            }
        }
        const originalGetText = instance.getText;
        instance.geText = function(this: DokuWikiSelection): string {
            if (isActive() && isTarget(this.obj)) {
                return saveSelectionText(this);
            }
            return originalGetText ? originalGetText.call(this) : "";
        };
        return instance;
    };

    dwEditor.setWrap = function(this: unknown, target: unknown, value: unknown): any {
        const result = callOriginal(original.setWrap, this, [target, value]);
        if (isActive() && isTarget(target) && editor.setLineWrapping) {
            editor.setLineWrapping(value !== "off");
        }
        return result;
    };

    dwEditor.sizeCtl = function(this: unknown, target: unknown, value: unknown): any {
        const result = callOriginal(original.sizeCtl, this, [target, value]);
        if (isActive() && isTarget(target) && editor.refreshLayout) {
            editor.refreshLayout();
        }
        return result;
    };

    dokuWindow.currentHeadlineLevel = function(
        this: unknown,
        id: unknown,
        ...args: any[]
    ): any {
        if (isActive() && isTargetTextareaId(editor, id)) {
            editor.syncForSubmit();
        }
        return callOriginal(original.currentHeadlineLevel, this, [id, ...args]);
    };

    dokuWindow.selection_class = selectionClass;

    dokuWindow.DWgetSelection = function(this: unknown, target: unknown, ...args: any[]): any {
        if (!isActive() || !isTarget(target)) {
            return callOriginal(original.getSelection, this, [target, ...args]);
        }
        const selection = Reflect.construct(
            dokuWindow.selection_class as unknown as Function,
            [],
        ) as DokuWikiSelection;
        const values = editor.getSelection();
        selection.obj = target;
        selection.start = values.start;
        selection.end = values.end;
        // edittable reads the textarea synchronously during toolbar actions.
        editor.syncForSubmit();
        return selection;
    };

    dokuWindow.DWsetSelection = function(this: unknown, selection: DokuWikiSelection, ...args: any[]): any {
        if (!isActive() || !selection || !isTarget(selection.obj)) {
            return callOriginal(original.setSelection, this, [selection, ...args]);
        }
        editor.setSelection(selectionValues(selection));
        editor.focus();
        return undefined;
    };

    dokuWindow.pasteText = function(
        this: unknown,
        selection: DokuWikiSelection,
        text: string,
        pasteOptions?: unknown,
        ...args: any[]
    ): any {
        if (!isActive() || !selection || !isTarget(selection.obj)) {
            return callOriginal(original.pasteText, this, [
                selection,
                text,
                pasteOptions,
                ...args,
            ]);
        }
        editor.syncForSubmit();
        const values = selectionValues(selection);
        editor.replaceText(values.start, values.end, text);
        const result = callOriginal(original.pasteText, this, [
            selection,
            text,
            pasteOptions,
            ...args,
        ]);
        editor.focus();
        return result;
    };

    function uninstall(): void {
        if (uninstalled) {
            return;
        }
        uninstalled = true;
        snapshots.forEach(restore);
        if (createdDwEditor) {
            delete dokuWindow.dw_editor;
        }
    }

    return {
        toolbar: createToolbarPort(
            (target) => dokuWindow.DWgetSelection?.call(dokuWindow, target) as DokuWikiSelection,
            (selection, text, pasteOptions) => {
                dokuWindow.pasteText?.call(dokuWindow, selection, text, pasteOptions);
            },
        ),
        uninstall,
        destroy: uninstall,
    };
}

function isTargetTextareaId(editor: DokuWikiEditorPort, id: unknown): boolean {
    if (typeof id !== "string") {
        return false;
    }
    return editor.isTargetTextarea(`#${id}`);
}

export interface TextareaEditorPortOptions {
    readonly document?: Document;
    readonly saveButton?: Element | null;
    readonly autoHeight?: boolean;
}

export function createTextareaEditorPort(
    adapter: TextareaAdapter,
    options: TextareaEditorPortOptions = {},
): DokuWikiEditorPort {
    const textarea = adapter.textarea;
    const document = options.document ?? textarea.ownerDocument;
    const isTargetTextarea = (value: unknown): boolean => (
        value === textarea ||
        value === `#${textarea.id}` ||
        Boolean(value && typeof value === "object" &&
            (value as {0?: unknown})[0] === textarea)
    );
    const clamp = (value: number): number => Math.max(
        0,
        Math.min(adapter.editor.view.state.doc.length, value),
    );
    return {
        readValue: () => adapter.getValue(),
        writeValue: (value) => adapter.setValue(value),
        getSelection: () => {
            const range = adapter.getSelection().main;
            return {start: range.from, end: range.to};
        },
        setSelection: (selection) => {
            const values = orderedSelection(selection);
            adapter.editor.setSelection(EditorSelection.single(
                clamp(values.start),
                clamp(values.end),
            ));
        },
        getText: (start, end) => adapter.editor.view.state.sliceDoc(
            clamp(start),
            clamp(end),
        ),
        replaceText: (start, end, text) => {
            const from = clamp(start);
            const to = Math.max(from, clamp(end));
            adapter.editor.view.dispatch({
                changes: {from, to, insert: text},
            });
        },
        focus: () => adapter.editor.view.focus(),
        syncForSubmit: () => { adapter.syncToTextarea(); },
        isTargetTextarea,
        setLineWrapping: (enabled) => adapter.editor.setLineWrapping(enabled),
        refreshLayout: () => {
            if (options.autoHeight) {
                adapter.host.style.height = "auto";
            } else {
                const computed = document.defaultView?.getComputedStyle(textarea).height;
                const height = textarea.style.height || computed;
                if (height && height !== "auto" && height !== "0px") {
                    adapter.host.style.height = height;
                }
            }
            adapter.editor.view.requestMeasure();
        },
    };
}

export interface MountedDokuWikiEditor {
    readonly adapter: TextareaAdapter;
    readonly port: DokuWikiEditorPort;
    readonly bridge: DokuWikiBridge;
    readonly settings?: EditorSettingsController;
    destroy(): void;
}

const mountedDokuWikiEditors = new WeakMap<
    HTMLTextAreaElement,
    MountedDokuWikiEditor
>();

export function getMountedDokuWikiEditor(
    textarea: HTMLTextAreaElement,
): MountedDokuWikiEditor | undefined {
    return mountedDokuWikiEditors.get(textarea);
}

export interface MountDokuWikiEditorOptions extends Omit<
    TextareaAdapterOptions,
    "extensions" | "onChange"
> {
    readonly window: DokuWikiWindow;
    readonly lockTimer?: LockTimer;
    readonly now?: () => Date;
    readonly isOuterMode?: IsOuterMode;
    readonly isActive?: () => boolean;
    readonly onSaveRequest?: () => void;
    readonly completionExtension?: Extension;
    readonly editorOptions?: TextareaEditorPortOptions;
    readonly settings?: EditorSettingsOptions;
}

export function mountDokuWikiEditor(
    options: MountDokuWikiEditorOptions,
): MountedDokuWikiEditor {
    const existing = mountedDokuWikiEditors.get(options.textarea);
    if (existing) {
        return existing;
    }
    let adapter: TextareaAdapter | undefined;
    const lockSync = createLockTimerSync({
        timer: options.lockTimer,
        now: options.now,
        sync: () => adapter?.syncToTextarea(),
    });
    const extensions: Extension = [
        createDokuWikiKeymap(
            options.onSaveRequest ?? (() => {
                const button = options.editorOptions?.saveButton ??
                    options.window.document.getElementById("edbtn__save");
                (button as HTMLElement | null)?.click();
            }),
            options.isOuterMode,
        ),
        options.completionExtension ?? [],
    ];
    adapter = mountTextArea({
        ...options,
        extensions,
        onChange: () => { lockSync.update(); },
    });
    const port = createTextareaEditorPort(adapter, {
        ...options.editorOptions,
        autoHeight: options.autoHeight ?? options.editorOptions?.autoHeight,
    });
    const bridge = installDokuWikiBridge({
        window: options.window,
        editor: port,
        lockTimer: options.lockTimer,
        now: options.now,
        isOuterMode: options.isOuterMode,
        isActive: options.isActive,
    });
    const settings = options.settings ? createEditorSettings(
        adapter.editor,
        options.settings,
    ) : undefined;
    let destroyed = false;
    const mounted: MountedDokuWikiEditor = {
        adapter,
        port,
        bridge,
        settings,
        destroy(): void {
            if (destroyed) {
                return;
            }
            destroyed = true;
            mountedDokuWikiEditors.delete(options.textarea);
            settings?.dispose();
            bridge.destroy();
            adapter?.destroy();
        },
    };
    mountedDokuWikiEditors.set(options.textarea, mounted);
    return mounted;
}

export type { EditorView };
