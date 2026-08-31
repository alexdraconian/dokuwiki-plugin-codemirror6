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
    createEmbeddedLanguageRegistry,
    type EmbeddedLanguageRegistry,
} from "../language/embedded/language-registry";
import {
    createEmbeddedLanguageHighlighting,
    createStaticCodeHighlighter,
    type StaticCodeHighlighter,
} from "../language/embedded/highlighter";
import {
    createDokuWikiLanguage,
} from "../language/dokuwiki/stream-parser";
import {openSearchPanel} from "@codemirror/search";
import {
    mountDokuWikiEditor,
    type DokuWikiWindow,
    type MountedDokuWikiEditor,
} from "./bridge";
import type {LockTimer} from "./lock-timer";
import {
    createDokuWikiSettingsMenu,
    type DokuWikiCookieStore,
    type DokuWikiSettingName,
} from "../editor/settings";
import {createDokuWikiPageCompletion} from "../editor/page-completion";
import {readDokuWikiConfig, type DokuWikiConfig} from "./config";

interface DokuWikiCookieApi {
    getValue?: (key: string) => string | null | undefined;
    setValue?: (key: string, value: string) => void;
}

interface DokuWikiPageWindow extends DokuWikiWindow {
    readonly JSINFO?: unknown;
    readonly DokuCookie?: DokuWikiCookieApi;
    readonly LANG?: {
        readonly plugins?: {
            readonly codemirror6?: Record<string, unknown>;
            readonly codemirror?: Record<string, unknown>;
        };
    };
    readonly dw_locktimer?: LockTimer;
}

export interface DokuWikiPageIntegrationOptions {
    readonly window?: DokuWikiPageWindow;
    readonly document?: Document;
}

export interface DokuWikiPageIntegration {
    readonly config: DokuWikiConfig;
    readonly registry: EmbeddedLanguageRegistry;
    readonly editor: MountedDokuWikiEditor | null;
    readonly staticHighlighter: StaticCodeHighlighter | null;
    readonly ready: Promise<void>;
    destroy(): void;
}

interface DokuWikiPluginInfo {
    readonly plugin_codemirror6?: unknown;
    readonly plugin_codemirror?: unknown;
}

const pageIntegrations = new WeakMap<Document, DokuWikiPageIntegration>();

function pluginInfo(value: unknown): DokuWikiPluginInfo | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const info = value as DokuWikiPluginInfo;
    return info.plugin_codemirror6 === undefined && info.plugin_codemirror === undefined ? null : info;
}

function cookieStore(window: DokuWikiPageWindow): DokuWikiCookieStore | null {
    const api = window.DokuCookie;
    if (
        !api ||
        typeof api.getValue !== "function" ||
        typeof api.setValue !== "function"
    ) {
        return null;
    }
    return {
        getValue: (key) => api.getValue?.(key),
        setValue: (key, value) => { api.setValue?.(key, value); },
    };
}

function pageLabels(
    window: DokuWikiPageWindow,
): Partial<Record<DokuWikiSettingName, string>> {
    const labels = window.LANG?.plugins?.codemirror6 ?? window.LANG?.plugins?.codemirror;
    if (!labels) {
        return {};
    }
    const result: Partial<Record<DokuWikiSettingName, string>> = {};
    for (const name of [
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
    ] as const) {
        const label = labels[`setting_${name}`];
        if (typeof label === "string") {
            result[name] = label;
        }
    }
    return result;
}

function pageSearchLabel(window: DokuWikiPageWindow): string | undefined {
    const labels = window.LANG?.plugins?.codemirror6 ?? window.LANG?.plugins?.codemirror;
    const label = labels?.findreplace;
    return typeof label === "string" ? label : undefined;
}

function textareaSelection(textarea: HTMLTextAreaElement): {
    readonly start: number;
    readonly end: number;
} {
    return {
        start: textarea.selectionStart ?? 0,
        end: textarea.selectionEnd ?? 0,
    };
}

function sizeControlHeight(
    window: DokuWikiPageWindow,
    autoHeight: boolean,
): string | undefined {
    if (autoHeight) {
        return undefined;
    }
    const stored = window.DokuCookie?.getValue?.("sizeCtl");
    if (typeof stored === "string" && /^\d+px$/.test(stored) &&
        Number.parseInt(stored, 10) > 0) {
        return stored;
    }
    return "300px";
}

function assetBaseUrl(config: DokuWikiConfig): string | undefined {
    if (!config.baseURL) {
        return undefined;
    }
    return `${config.baseURL}/dist/cm6/languages`;
}

function mountEditor(
    dokuWindow: DokuWikiPageWindow,
    document: Document,
    config: DokuWikiConfig,
    registry: EmbeddedLanguageRegistry,
): MountedDokuWikiEditor | null {
    const element = document.getElementById("wiki__text");
    if (!element || element.tagName.toLowerCase() !== "textarea") {
        return null;
    }
    const textarea = element as HTMLTextAreaElement;
    const form = textarea.form;
    const saveButton = document.getElementById("edbtn__save");
    let nativeMode = false;
    let mounted: MountedDokuWikiEditor | undefined;
    const textareaDisplay = textarea.style.display;

    const parserCallbacks = registry.parserCallbacks();
    const parserConfig = {
        acronyms: config.acronyms,
        camelcase: config.camelcase,
        entities: config.entities,
        loadEmbeddedMode: parserCallbacks.loadEmbeddedMode,
        plugins: config.plugins,
        schemes: config.schemes,
        smileys: config.smileys,
        validLang: parserCallbacks.validLang,
    };
    let embeddedHighlighting: ReturnType<
        typeof createEmbeddedLanguageHighlighting
    >;
    const refreshDokuWikiParser = (): void => {
        if (!mounted || mounted.settings?.get("syntax") !== "1") {
            return;
        }
        mounted.adapter.editor.reconfigure(
            mounted.adapter.editor.compartments.language,
            [createDokuWikiLanguage(parserConfig), embeddedHighlighting],
        );
    };
    embeddedHighlighting = createEmbeddedLanguageHighlighting(
        registry,
        refreshDokuWikiParser,
    );
    const syntaxExtension = [
        createDokuWikiLanguage(parserConfig),
        embeddedHighlighting,
    ];

    const setNativeMode = (enabled: boolean): void => {
        if (!mounted || nativeMode === enabled) {
            return;
        }
        nativeMode = enabled;
        if (enabled) {
            mounted.port.syncForSubmit();
            textarea.style.display = textareaDisplay;
            mounted.adapter.host.hidden = true;
            textarea.focus();
            return;
        }

        const selection = textareaSelection(textarea);
        mounted.adapter.setValue(textarea.value);
        mounted.port.setSelection(selection);
        textarea.style.display = "none";
        mounted.adapter.host.hidden = false;
        mounted.port.focus();
    };

    mounted = mountDokuWikiEditor({
        window: dokuWindow,
        textarea,
        form,
        height: sizeControlHeight(dokuWindow, config.autoheight),
        autoHeight: config.autoheight,
        lineWrapping: textarea.wrap !== "off",
        readOnly: textarea.readOnly,
        tabSize: 8,
        syncOnSubmit: () => !nativeMode,
        lockTimer: dokuWindow.dw_locktimer,
        isActive: () => !nativeMode,
        onSaveRequest: () => { (saveButton as HTMLElement | null)?.click(); },
        completionExtension: config.pageautocomplete ?
            createDokuWikiPageCompletion({
                endpoint: config.pageautocompleteEndpoint,
                call: config.pageautocompleteCall,
                namespace: config.pageautocompleteNamespace,
                limit: config.pageautocompleteLimit,
            }) : [],
        settings: {
            config,
            cookies: cookieStore(dokuWindow),
            syntaxExtension,
            onNativeEditorChange: setNativeMode,
        },
        editorOptions: {
            document,
            saveButton,
            autoHeight: config.autoheight,
        },
    });
    nativeMode = mounted.settings?.get("nativeeditor") === "1";
    if (nativeMode) {
        mounted.port.syncForSubmit();
        textarea.style.display = textareaDisplay;
        mounted.adapter.host.hidden = true;
    }

    return mounted;
}

export function startDokuWikiPage(
    options: DokuWikiPageIntegrationOptions = {},
): DokuWikiPageIntegration | null {
    const dokuWindow = options.window ?? (
        typeof window === "undefined" ? undefined : window as DokuWikiPageWindow
    );
    if (!dokuWindow) {
        return null;
    }
    const document = options.document ?? dokuWindow.document;
    if (pageIntegrations.has(document)) {
        return pageIntegrations.get(document) as DokuWikiPageIntegration;
    }
    const info = pluginInfo(dokuWindow.JSINFO);
    if (!info) {
        return null;
    }

    const config = readDokuWikiConfig(dokuWindow.JSINFO);
    const registry = createEmbeddedLanguageRegistry({
        assetBaseUrl: assetBaseUrl(config),
    });
    const editor = mountEditor(dokuWindow, document, config, registry);
    const menu = editor?.settings ? createDokuWikiSettingsMenu({
        controller: editor.settings,
        document,
        iconURL: config.iconURL || undefined,
        labels: pageLabels(dokuWindow),
        searchLabel: pageSearchLabel(dokuWindow),
        onOpenSearch: () => {
            if (editor) {
                openSearchPanel(editor.adapter.editor.view);
            }
        },
    }) : null;
    const staticHighlighter = config.codesyntax ?
        createStaticCodeHighlighter(document, registry, {enabled: true}) : null;
    const ready = Promise.all([
        editor?.settings?.ready ?? Promise.resolve(),
        staticHighlighter?.refresh() ?? Promise.resolve(),
    ]).then(() => undefined);
    let destroyed = false;
    const integration: DokuWikiPageIntegration = {
        config,
        registry,
        editor,
        staticHighlighter,
        ready,
        destroy(): void {
            if (destroyed) {
                return;
            }
            destroyed = true;
            pageIntegrations.delete(document);
            menu?.destroy();
            staticHighlighter?.destroy();
            editor?.destroy();
        },
    };
    pageIntegrations.set(document, integration);
    return integration;
}

export function autoStartDokuWikiPage(): void {
    const integration = startDokuWikiPage();
    if (integration) {
        const dokuWindow = integration.editor?.adapter.textarea.ownerDocument.defaultView;
        if (dokuWindow) {
            (dokuWindow as Window & {
                __dokuWikiCodeMirror6?: DokuWikiPageIntegration;
            }).__dokuWikiCodeMirror6 = integration;
        }
    }
}
