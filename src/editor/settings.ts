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
import {
    closeBrackets,
} from "@codemirror/autocomplete";
import {
    defaultKeymap,
    emacsStyleKeymap,
    historyKeymap,
    standardKeymap,
} from "@codemirror/commands";
import {
    bracketMatching,
} from "@codemirror/language";
import {
    searchKeymap,
} from "@codemirror/search";
import {
    type Extension,
} from "@codemirror/state";
import {
    highlightActiveLine,
    highlightSpecialChars,
    highlightWhitespace,
    keymap as cmKeymap,
    lineNumbers,
    type KeyBinding,
} from "@codemirror/view";

import type {DokuWikiConfig} from "../dokuwiki/config";
import type {EditorController} from "./create-editor";
import {vim} from "@replit/codemirror-vim";
import {
    dokuWikiSublimeKeymap,
    sublimeKeymapExtension,
} from "./sublime-keymap";
import {
    dokuWikiFontSize,
    dokuWikiScrollbar,
    dokuWikiTheme,
    dokuWikiThemeNames,
    type DokuWikiThemeName,
} from "./themes";

export type DokuWikiBooleanSetting =
    | "activeline"
    | "closebrackets"
    | "linenumbers"
    | "matchbrackets"
    | "nativeeditor"
    | "showinvisibles"
    | "syntax";

export type DokuWikiChoiceSetting = "fontsize" | "keymap" | "theme";
export type DokuWikiSettingName =
    | DokuWikiBooleanSetting
    | DokuWikiChoiceSetting;

export const dokuWikiSettingNames: readonly DokuWikiSettingName[] = [
    "activeline",
    "closebrackets",
    "fontsize",
    "keymap",
    "linenumbers",
    "matchbrackets",
    "nativeeditor",
    "syntax",
    "showinvisibles",
    "theme",
];

export const dokuWikiSettingMenuOrder: readonly (DokuWikiSettingName | "-")[] = [
    "theme",
    "fontsize",
    "keymap",
    "closebrackets",
    "linenumbers",
    "activeline",
    "matchbrackets",
    "syntax",
    "showinvisibles",
    "-",
    "nativeeditor",
];

export const dokuWikiFontSizes = [
    "10", "11", "12", "13", "14", "16", "18", "20", "24",
] as const;

export type DokuWikiKeymapName = "default" | "emacs" | "sublime" | "vim";
export const dokuWikiKeymapNames: readonly DokuWikiKeymapName[] = [
    "default",
    "emacs",
    "sublime",
    "vim",
];

export interface DokuWikiCookieStore {
    getValue(key: string): string | null | undefined;
    setValue(key: string, value: string): void;
}

export interface DokuWikiSettingDefinition {
    readonly defaultValue: string | ((config: Partial<DokuWikiConfig>) => string);
    readonly choices?: readonly string[];
}

const booleanChoices = ["0", "1"] as const;
const settingDefinitions: Readonly<
    Record<DokuWikiSettingName, DokuWikiSettingDefinition>
> = {
    activeline: {defaultValue: "0", choices: booleanChoices},
    closebrackets: {defaultValue: "0", choices: booleanChoices},
    fontsize: {defaultValue: "14", choices: dokuWikiFontSizes},
    keymap: {defaultValue: "default", choices: dokuWikiKeymapNames},
    linenumbers: {defaultValue: "0", choices: booleanChoices},
    matchbrackets: {defaultValue: "1", choices: booleanChoices},
    nativeeditor: {
        defaultValue: (config) => config.nativeeditor ? "1" : "0",
        choices: booleanChoices,
    },
    syntax: {defaultValue: "1", choices: booleanChoices},
    showinvisibles: {defaultValue: "0", choices: booleanChoices},
    theme: {defaultValue: "default", choices: dokuWikiThemeNames},
};

export const dokuWikiSettingDefinitions = settingDefinitions;

export type DokuWikiSettingValues = Record<DokuWikiSettingName, string>;

function defaultValue(
    name: DokuWikiSettingName,
    config: Partial<DokuWikiConfig>,
): string {
    const value = settingDefinitions[name].defaultValue;
    return typeof value === "function" ? value(config) : value;
}

export function validateDokuWikiSetting(
    name: DokuWikiSettingName,
    value: unknown,
    config: Partial<DokuWikiConfig> = {},
): string {
    const definition = settingDefinitions[name];
    const candidate = typeof value === "string" ? value : "";
    return definition.choices?.includes(candidate) ?
        candidate : defaultValue(name, config);
}

export function readDokuWikiSettings(
    cookies: DokuWikiCookieStore | null | undefined,
    config: Partial<DokuWikiConfig> = {},
): DokuWikiSettingValues {
    const values = {} as DokuWikiSettingValues;
    for (const name of dokuWikiSettingNames) {
        const key = `cm-${name}`;
        const value = validateDokuWikiSetting(
            name,
            cookies?.getValue(key),
            config,
        );
        values[name] = value;
        cookies?.setValue(key, value);
    }
    return values;
}

export type KeymapLoader = (
    name: DokuWikiKeymapName,
) => Promise<readonly KeyBinding[]>;

export const dokuWikiKeymaps: Readonly<
    Record<DokuWikiKeymapName, readonly KeyBinding[]>
> = Object.freeze({
    default: [...searchKeymap, ...defaultKeymap, ...historyKeymap],
    emacs: [...searchKeymap, ...emacsStyleKeymap, ...standardKeymap, ...historyKeymap],
    sublime: [...searchKeymap, ...dokuWikiSublimeKeymap, ...historyKeymap],
    // Vim is a stateful CM6 extension, so it is installed directly below.
    // Keep the shared bindings in this compatibility view for API consumers.
    vim: [...searchKeymap, ...standardKeymap, ...historyKeymap],
});

export function loadDokuWikiKeymap(
    name: DokuWikiKeymapName,
): Promise<readonly KeyBinding[]> {
    return Promise.resolve(dokuWikiKeymaps[name]);
}

export type KeymapLoadStatus = "idle" | "loading" | "loaded" | "failed";

export interface KeymapState {
    readonly name: DokuWikiKeymapName;
    readonly status: KeymapLoadStatus;
    readonly error?: unknown;
}

export interface EditorSettingsChange {
    readonly name: DokuWikiSettingName;
    readonly value: string;
    readonly keymap?: KeymapState;
}

export interface EditorSettingsOptions {
    readonly config?: Partial<DokuWikiConfig>;
    readonly cookies?: DokuWikiCookieStore | null;
    readonly syntaxExtension?: Extension;
    readonly keymapLoader?: KeymapLoader;
    readonly onNativeEditorChange?: (enabled: boolean) => void;
}

export interface EditorSettingsController {
    readonly ready: Promise<void>;
    readonly values: DokuWikiSettingValues;
    get(name: DokuWikiSettingName): string;
    getKeymapState(): KeymapState;
    set(name: DokuWikiSettingName, value: unknown): Promise<EditorSettingsChange>;
    retryKeymap(): Promise<EditorSettingsChange>;
    subscribe(listener: (change: EditorSettingsChange) => void): () => void;
    dispose(): void;
}

function isEnabled(values: DokuWikiSettingValues, name: DokuWikiBooleanSetting): boolean {
    return values[name] === "1";
}

function displayExtensions(values: DokuWikiSettingValues): Extension {
    const extensions: Extension[] = [];
    if (isEnabled(values, "linenumbers")) {
        extensions.push(lineNumbers());
    }
    if (isEnabled(values, "activeline")) {
        extensions.push(highlightActiveLine());
    }
    if (isEnabled(values, "matchbrackets")) {
        extensions.push(bracketMatching());
    }
    if (isEnabled(values, "showinvisibles")) {
        extensions.push(highlightSpecialChars(), highlightWhitespace());
    }
    return extensions;
}

function behaviorExtensions(values: DokuWikiSettingValues): Extension {
    return isEnabled(values, "closebrackets") ? closeBrackets() : [];
}

function themeExtensions(values: DokuWikiSettingValues): Extension {
    return [
        dokuWikiTheme(values.theme),
        dokuWikiFontSize(values.fontsize),
    ];
}

function emit(
    listeners: Set<(change: EditorSettingsChange) => void>,
    change: EditorSettingsChange,
): void {
    for (const listener of Array.from(listeners)) {
        listener(change);
    }
}

export function createEditorSettings(
    editor: EditorController,
    options: EditorSettingsOptions = {},
): EditorSettingsController {
    const config = options.config ?? {};
    const values = readDokuWikiSettings(options.cookies, config);
    const listeners = new Set<(change: EditorSettingsChange) => void>();
    const loader = options.keymapLoader ?? loadDokuWikiKeymap;
    const useBuiltInSublime = !options.keymapLoader;
    let keymapState: KeymapState = {
        name: values.keymap as DokuWikiKeymapName,
        status: "idle",
    };
    let keymapGeneration = 0;
    let disposed = false;

    function reconfigureVisuals(): void {
        editor.reconfigure(editor.compartments.display, displayExtensions(values));
        editor.reconfigure(editor.compartments.behavior, behaviorExtensions(values));
        editor.reconfigure(editor.compartments.theme, themeExtensions(values));
        editor.reconfigure(
            editor.compartments.scrollbar,
            dokuWikiScrollbar(Boolean(config.usenativescroll)),
        );
        editor.reconfigure(
            editor.compartments.language,
            isEnabled(values, "syntax") ? options.syntaxExtension ?? [] : [],
        );
    }

    async function applyKeymap(name: DokuWikiKeymapName): Promise<KeymapState> {
        const generation = ++keymapGeneration;
        keymapState = {name, status: "loading"};
        try {
            const bindings = await loader(name);
            if (disposed || generation !== keymapGeneration) {
                return keymapState;
            }
            if (!Array.isArray(bindings)) {
                throw new Error(`Keymap loader returned no bindings for ${name}`);
            }
            editor.reconfigure(
                editor.compartments.keymap,
                name === "vim" ?
                    vim() :
                    name === "sublime" && useBuiltInSublime ?
                        sublimeKeymapExtension() :
                        cmKeymap.of(bindings),
            );
            keymapState = {name, status: "loaded"};
        } catch (error) {
            if (disposed || generation !== keymapGeneration) {
                return keymapState;
            }
            // Keep the editor usable on a provider error and expose the error
            // to the caller/menu instead of polling or silently hanging.
            editor.reconfigure(
                editor.compartments.keymap,
                cmKeymap.of(dokuWikiKeymaps.default),
            );
            keymapState = {name, status: "failed", error};
        }
        return keymapState;
    }

    reconfigureVisuals();
    const ready = applyKeymap(keymapState.name).then(() => undefined);

    const controller: EditorSettingsController = {
        ready,
        get values(): DokuWikiSettingValues {
            return Object.freeze({...values});
        },
        get(name): string {
            return values[name];
        },
        getKeymapState(): KeymapState {
            return keymapState;
        },
        async set(name, value): Promise<EditorSettingsChange> {
            if (disposed) {
                throw new Error("The editor settings controller has been disposed");
            }
            const next = validateDokuWikiSetting(name, value, config);
            values[name] = next;
            options.cookies?.setValue(`cm-${name}`, next);

            let nextKeymap: KeymapState | undefined;
            if (name === "keymap") {
                nextKeymap = await applyKeymap(next as DokuWikiKeymapName);
            } else {
                reconfigureVisuals();
            }
            if (name === "nativeeditor") {
                options.onNativeEditorChange?.(next === "1");
            }
            const change = {name, value: next, keymap: nextKeymap};
            emit(listeners, change);
            return change;
        },
        async retryKeymap(): Promise<EditorSettingsChange> {
            const name = values.keymap as DokuWikiKeymapName;
            const state = await applyKeymap(name);
            const change = {name: "keymap" as const, value: name, keymap: state};
            emit(listeners, change);
            return change;
        },
        subscribe(listener): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose(): void {
            disposed = true;
            keymapGeneration += 1;
            listeners.clear();
        },
    };
    return controller;
}

export interface DokuWikiSettingsMenuOptions {
    readonly document: Document;
    readonly controller: EditorSettingsController;
    readonly iconURL?: string;
    readonly labels?: Partial<Record<DokuWikiSettingName, string>>;
    readonly searchLabel?: string;
    readonly onOpenSearch?: () => void;
    readonly parent?: Element | null;
}

const settingLabels: Record<DokuWikiSettingName, string> = {
    activeline: "Highlight current line",
    closebrackets: "Auto-close brackets",
    fontsize: "Font size",
    keymap: "Key map",
    linenumbers: "Display line numbers",
    matchbrackets: "Highlight matching brackets",
    nativeeditor: "Native DokuWiki editor",
    syntax: "Highlight syntax",
    showinvisibles: "Show Whitespace",
    theme: "Color theme",
};

function menuChoices(name: DokuWikiSettingName): readonly string[] {
    return settingDefinitions[name].choices ?? [];
}

let settingsMenuSequence = 0;

function directMenuItems(scope: Element): HTMLButtonElement[] {
    return Array.from(scope.querySelectorAll(":scope > li > button")).filter(
        (item): item is HTMLButtonElement => (
            item instanceof HTMLButtonElement && !item.disabled
        ),
    );
}

/** Creates a keyboard-accessible settings menu without a jQuery dependency. */
export function createDokuWikiSettingsMenu(
    options: DokuWikiSettingsMenuOptions,
): {destroy(): void; button: HTMLButtonElement; menu: HTMLUListElement} {
    const document = options.document;
    const parent = options.parent ??
        document.getElementById("size__ctl") ??
        document.getElementById("draft__status");
    if (!parent) {
        throw new Error("Cannot place the CodeMirror settings menu");
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-settings-button";
    button.dataset.codemirror6Settings = "true";
    button.setAttribute("aria-label", "CodeMirror settings");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    if (options.iconURL) {
        const image = document.createElement("img");
        image.src = options.iconURL;
        image.alt = "";
        button.append(image);
    } else {
        button.textContent = "⚙";
    }

    const menu = document.createElement("ul");
    menu.className = "cm-settings-menu";
    menu.dataset.codemirror6Settings = "true";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    const menuSequence = ++settingsMenuSequence;

    if (options.onOpenSearch) {
        const searchItem = document.createElement("li");
        searchItem.setAttribute("role", "none");
        const searchButton = document.createElement("button");
        searchButton.type = "button";
        searchButton.dataset.action = "open-search";
        searchButton.textContent = options.searchLabel ?? "Find and replace";
        searchButton.setAttribute("role", "menuitem");
        searchItem.append(searchButton);
        menu.append(searchItem);

        const separator = document.createElement("li");
        separator.setAttribute("role", "separator");
        menu.append(separator);
    }

    function createSettingButton(
        name: DokuWikiSettingName,
        choice: string | null,
    ): HTMLButtonElement {
        const choiceButton = document.createElement("button");
        choiceButton.type = "button";
        choiceButton.dataset.setting = name;
        if (choice !== null) {
            choiceButton.dataset.choice = choice;
        }
        const label = options.labels?.[name] ?? settingLabels[name];
        choiceButton.textContent = choice === null ?
            label : label + ": " + choice;
        choiceButton.setAttribute(
            "role",
            choice === null ? "menuitemcheckbox" : "menuitemradio",
        );
        return choiceButton;
    }

    for (const name of dokuWikiSettingMenuOrder) {
        if (name === "-") {
            const separator = document.createElement("li");
            separator.setAttribute("role", "separator");
            menu.append(separator);
            continue;
        }
        const choices = menuChoices(name);
        const item = document.createElement("li");
        item.setAttribute("role", "none");
        if (choices === booleanChoices) {
            item.append(createSettingButton(name, null));
            menu.append(item);
            continue;
        }

        item.className = "cm-settings-group";
        const groupButton = document.createElement("button");
        groupButton.type = "button";
        groupButton.className = "cm-settings-group-button";
        groupButton.dataset.submenu = name;
        groupButton.textContent = options.labels?.[name] ?? settingLabels[name];
        groupButton.setAttribute("role", "menuitem");
        groupButton.setAttribute("aria-haspopup", "menu");
        groupButton.setAttribute("aria-expanded", "false");

        const submenu = document.createElement("ul");
        submenu.className = "cm-settings-submenu";
        submenu.id = "cm-settings-submenu-" + menuSequence + "-" + name;
        submenu.setAttribute("role", "menu");
        submenu.hidden = true;
        groupButton.setAttribute("aria-controls", submenu.id);
        for (const choice of choices) {
            const choiceItem = document.createElement("li");
            choiceItem.setAttribute("role", "none");
            choiceItem.append(createSettingButton(name, choice));
            submenu.append(choiceItem);
        }
        item.append(groupButton, submenu);
        menu.append(item);
    }

    parent.append(button, menu);
    const viewport = document.defaultView;
    let openSubmenu: HTMLUListElement | null = null;

    function viewportSize(): {readonly width: number; readonly height: number} {
        return {
            width: viewport?.innerWidth || document.documentElement.clientWidth || 1024,
            height: viewport?.innerHeight || document.documentElement.clientHeight || 768,
        };
    }

    function placeRootMenu(): void {
        const rect = button.getBoundingClientRect();
        const size = viewportSize();
        const margin = 8;
        menu.style.visibility = "hidden";
        const width = menu.offsetWidth;
        const height = menu.offsetHeight;
        const left = Math.max(
            margin,
            Math.min(rect.right - width, size.width - width - margin),
        );
        const above = rect.top - height - margin;
        const candidateTop = above >= margin ?
            above :
            Math.min(rect.bottom + margin, size.height - height - margin);
        const maxTop = Math.max(margin, size.height - height - margin);
        const top = Math.min(Math.max(margin, candidateTop), maxTop);
        menu.style.left = Math.round(Math.max(margin, left)) + "px";
        menu.style.top = Math.round(top) + "px";
        menu.style.visibility = "visible";
    }

    function submenuButton(submenu: HTMLUListElement): HTMLButtonElement | null {
        const item = submenu.parentElement;
        const candidate = item?.querySelector(":scope > button[data-submenu]");
        return candidate instanceof HTMLButtonElement ? candidate : null;
    }

    function placeSubmenu(submenu: HTMLUListElement): void {
        const groupButton = submenuButton(submenu);
        if (!groupButton) {
            return;
        }
        const rect = groupButton.getBoundingClientRect();
        const size = viewportSize();
        const margin = 8;
        submenu.style.visibility = "hidden";
        const width = submenu.offsetWidth;
        const height = submenu.offsetHeight;
        const right = rect.right + 4;
        const left = right + width <= size.width - margin ?
            right :
            rect.left - width - 4;
        const top = Math.min(
            Math.max(margin, rect.top),
            size.height - height - margin,
        );
        submenu.style.left = Math.round(Math.max(margin, left)) + "px";
        submenu.style.top = Math.round(Math.max(margin, top)) + "px";
        submenu.style.visibility = "visible";
    }

    function closeSubmenu(submenu: HTMLUListElement): void {
        submenu.hidden = true;
        submenuButton(submenu)?.setAttribute("aria-expanded", "false");
        if (openSubmenu === submenu) {
            openSubmenu = null;
        }
    }

    function closeAllSubmenus(): void {
        menu.querySelectorAll<HTMLUListElement>("ul.cm-settings-submenu").forEach(
            closeSubmenu,
        );
    }

    function openMenuSubmenu(submenu: HTMLUListElement): void {
        closeAllSubmenus();
        openSubmenu = submenu;
        submenu.hidden = false;
        submenuButton(submenu)?.setAttribute("aria-expanded", "true");
        placeSubmenu(submenu);
        directMenuItems(submenu)[0]?.focus();
    }

    function render(): void {
        const native = options.controller.get("nativeeditor") === "1";
        const searchButton = menu.querySelector<HTMLButtonElement>(
            "button[data-action=open-search]",
        );
        if (searchButton) {
            searchButton.disabled = native;
        }
        menu.querySelectorAll<HTMLButtonElement>("button[data-setting]").forEach((item) => {
            const name = item.dataset.setting as DokuWikiSettingName;
            const choice = item.dataset.choice;
            const selected = choice === undefined ?
                options.controller.get(name) === "1" :
                options.controller.get(name) === choice;
            item.setAttribute("aria-checked", selected ? "true" : "false");
            item.classList.toggle("cm-setting-selected", selected);
            item.disabled = native && name !== "nativeeditor";
        });
        menu.querySelectorAll<HTMLButtonElement>("button[data-submenu]").forEach(
            (item) => {
                item.disabled = native;
                if (item.disabled && item.getAttribute("aria-expanded") === "true") {
                    const submenu = item.parentElement?.querySelector(
                        ":scope > ul.cm-settings-submenu",
                    );
                    if (submenu instanceof HTMLUListElement) {
                        closeSubmenu(submenu);
                    }
                }
            },
        );
    }

    const unsubscribe = options.controller.subscribe(render);

    function close(): void {
        closeAllSubmenus();
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
    }

    function onButtonClick(event: MouseEvent): void {
        event.stopPropagation();
        if (!menu.hidden) {
            close();
            return;
        }
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
        placeRootMenu();
        directMenuItems(menu)[0]?.focus();
    }

    function onMenuClick(event: MouseEvent): void {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
            return;
        }
        if (target.disabled) {
            return;
        }
        if (target.dataset.submenu) {
            const submenu = target.parentElement?.querySelector(
                ":scope > ul.cm-settings-submenu",
            );
            if (submenu instanceof HTMLUListElement) {
                if (submenu.hidden) {
                    openMenuSubmenu(submenu);
                } else {
                    closeSubmenu(submenu);
                }
            }
            return;
        }
        if (target.dataset.action === "open-search") {
            close();
            options.onOpenSearch?.();
            return;
        }
        const name = target.dataset.setting as DokuWikiSettingName | undefined;
        const choice = target.dataset.choice;
        if (name) {
            const next = choice ??
                (options.controller.get(name) === "1" ? "0" : "1");
            void options.controller.set(name, next);
            close();
        }
    }

    function onMenuKeydown(event: KeyboardEvent): void {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
            return;
        }
        const submenu = target.closest("ul.cm-settings-submenu");
        const scope = submenu instanceof HTMLUListElement ? submenu : menu;
        const items = directMenuItems(scope);
        const current = items.indexOf(target);
        if (event.key === "Escape") {
            event.preventDefault();
            if (submenu instanceof HTMLUListElement) {
                closeSubmenu(submenu);
                submenuButton(submenu)?.focus();
            } else {
                close();
                button.focus();
            }
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? 1 : -1;
            items[(current + delta + items.length) % items.length]?.focus();
        } else if (event.key === "ArrowRight" && target.dataset.submenu) {
            event.preventDefault();
            const child = target.parentElement?.querySelector(
                ":scope > ul.cm-settings-submenu",
            );
            if (child instanceof HTMLUListElement) {
                openMenuSubmenu(child);
            }
        } else if (
            event.key === "ArrowLeft" &&
            submenu instanceof HTMLUListElement
        ) {
            event.preventDefault();
            closeSubmenu(submenu);
            submenuButton(submenu)?.focus();
        }
    }

    function onDocumentClick(event: MouseEvent): void {
        const target = event.target;
        if (target instanceof Node && !menu.contains(target) && target !== button) {
            close();
        }
    }

    function onViewportChange(): void {
        if (menu.hidden) {
            return;
        }
        placeRootMenu();
        if (openSubmenu && !openSubmenu.hidden) {
            placeSubmenu(openSubmenu);
        }
    }

    button.addEventListener("click", onButtonClick);
    menu.addEventListener("click", onMenuClick);
    menu.addEventListener("keydown", onMenuKeydown);
    document.addEventListener("click", onDocumentClick);
    viewport?.addEventListener("resize", onViewportChange);
    document.addEventListener("scroll", onViewportChange, true);
    render();

    return {
        button,
        menu,
        destroy(): void {
            unsubscribe();
            button.removeEventListener("click", onButtonClick);
            menu.removeEventListener("click", onMenuClick);
            menu.removeEventListener("keydown", onMenuKeydown);
            document.removeEventListener("click", onDocumentClick);
            viewport?.removeEventListener("resize", onViewportChange);
            document.removeEventListener("scroll", onViewportChange, true);
            button.remove();
            menu.remove();
        },
    };
}

export type {DokuWikiThemeName};
