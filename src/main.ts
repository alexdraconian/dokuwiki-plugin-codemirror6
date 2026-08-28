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
import { StreamLanguage, syntaxTree } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import {
    createEditor,
    type EditorController,
} from "./editor/create-editor";
import {
    getMountedTextAreaAdapter,
    mountTextArea,
    type TextareaAdapter,
    type TextareaAdapterOptions,
} from "./editor/textarea-adapter";
import {
    dokuWikiDefaultTheme,
    dokuWikiFontSize,
    dokuWikiHighlightStyle,
    dokuWikiHighlighting,
    dokuWikiLightTheme,
    dokuWikiScrollbar,
    dokuWikiTheme,
    dokuWikiThemeNames,
    dokuWikiThemes,
} from "./editor/themes";
import {
    createDokuWikiSettingsMenu,
    createEditorSettings,
    dokuWikiFontSizes,
    dokuWikiKeymapNames,
    dokuWikiSettingDefinitions,
    dokuWikiSettingMenuOrder,
    dokuWikiSettingNames,
    loadDokuWikiKeymap,
    readDokuWikiSettings,
    validateDokuWikiSetting,
} from "./editor/settings";
import {
    createTextareaEditorPort,
    installDokuWikiBridge,
    getMountedDokuWikiEditor,
    mountDokuWikiEditor,
} from "./dokuwiki/bridge";
import {
    autoStartDokuWikiPage,
    startDokuWikiPage,
    type DokuWikiPageIntegration,
    type DokuWikiPageIntegrationOptions,
} from "./dokuwiki/page";
import { readDokuWikiConfig, type DokuWikiPage } from "./dokuwiki/config";
import {
    createDokuWikiPageCompletion,
    createDokuWikiPageCompletionSource,
} from "./editor/page-completion";
import {
    dokuWikiStyleNames,
    dokuWikiTokenTable,
} from "./language/dokuwiki/highlight";
import {
    createDokuWikiLanguage,
    createDokuWikiParser,
    dokuWiki,
    type DokuWikiParserConfig,
} from "./language/dokuwiki/stream-parser";

import {
    createEmbeddedLanguageHighlighting,
    createStaticCodeHighlighter,
    highlightEmbeddedBlock,
    highlightEmbeddedDocument,
    highlightStaticCodeBlocks,
    scanEmbeddedCodeBlocks,
} from "./language/embedded/highlighter";
import {
    createEmbeddedLanguageRegistry,
    type EmbeddedLanguageImport,
    type EmbeddedLanguageRegistry,
    type EmbeddedLanguageRegistryOptions,
} from "./language/embedded/language-registry";

import {createPluginSyntax, pluginSyntaxModules} from "./language/dokuwiki/syntax/plugins/registry";

export interface Cm6Runtime {
    readonly version: "phase-13-settings-and-static-highlight";
    readonly embeddedLanguageRegistry: EmbeddedLanguageRegistry;
    readonly createEmbeddedLanguageRegistry: typeof createEmbeddedLanguageRegistry;
    readonly createEmbeddedLanguageHighlighting: typeof createEmbeddedLanguageHighlighting;
    readonly createStaticCodeHighlighter: typeof createStaticCodeHighlighter;
    readonly highlightEmbeddedBlock: typeof highlightEmbeddedBlock;
    readonly highlightEmbeddedDocument: typeof highlightEmbeddedDocument;
    readonly highlightStaticCodeBlocks: typeof highlightStaticCodeBlocks;
    readonly createEditorSettings: typeof createEditorSettings;
    readonly createDokuWikiSettingsMenu: typeof createDokuWikiSettingsMenu;
    readonly createDokuWikiPageCompletion: typeof createDokuWikiPageCompletion;
    readonly createDokuWikiPageCompletionSource: typeof createDokuWikiPageCompletionSource;
    readonly readDokuWikiSettings: typeof readDokuWikiSettings;
    readonly validateDokuWikiSetting: typeof validateDokuWikiSetting;
    readonly loadDokuWikiKeymap: typeof loadDokuWikiKeymap;
    readonly dokuWikiSettingNames: typeof dokuWikiSettingNames;
    readonly dokuWikiSettingDefinitions: typeof dokuWikiSettingDefinitions;
    readonly dokuWikiSettingMenuOrder: typeof dokuWikiSettingMenuOrder;
    readonly dokuWikiFontSizes: typeof dokuWikiFontSizes;
    readonly dokuWikiKeymapNames: typeof dokuWikiKeymapNames;
    readonly scanEmbeddedCodeBlocks: typeof scanEmbeddedCodeBlocks;
    readonly createDokuWikiParserWithEmbeddedRegistry: (
        config?: Partial<DokuWikiParserConfig>,
    ) => ReturnType<typeof createDokuWikiParser>;
    readonly createDokuWikiLanguageWithEmbeddedRegistry: (
        config?: Partial<DokuWikiParserConfig>,
    ) => ReturnType<typeof createDokuWikiLanguage>;
    readonly dokuWiki: typeof dokuWiki;
    readonly createDokuWikiLanguage: typeof createDokuWikiLanguage;
    readonly createDokuWikiParser: typeof createDokuWikiParser;
    readonly createDokuWikiPluginSyntax: typeof createPluginSyntax;
    readonly dokuWikiPluginSyntaxModules: typeof pluginSyntaxModules;
    readonly dokuWikiDefaultTheme: typeof dokuWikiDefaultTheme;
    readonly dokuWikiThemeNames: typeof dokuWikiThemeNames;
    readonly dokuWikiThemes: typeof dokuWikiThemes;
    readonly dokuWikiTheme: typeof dokuWikiTheme;
    readonly dokuWikiFontSize: typeof dokuWikiFontSize;
    readonly dokuWikiScrollbar: typeof dokuWikiScrollbar;
    readonly dokuWikiHighlightStyle: typeof dokuWikiHighlightStyle;
    readonly dokuWikiHighlighting: typeof dokuWikiHighlighting;
    readonly dokuWikiLightTheme: typeof dokuWikiLightTheme;
    readonly dokuWikiStyleNames: typeof dokuWikiStyleNames;
    readonly dokuWikiTokenTable: typeof dokuWikiTokenTable;
    readonly EditorView: typeof EditorView;
    readonly StreamLanguage: typeof StreamLanguage;
    readonly syntaxTree: typeof syntaxTree;
    createState(documentText?: string, extension?: Extension): EditorState;
    createEditor: typeof createEditor;
    mountTextArea: typeof mountTextArea;
    getMountedTextAreaAdapter: typeof getMountedTextAreaAdapter;
    createTextareaEditorPort: typeof createTextareaEditorPort;
    installDokuWikiBridge: typeof installDokuWikiBridge;
    mountDokuWikiEditor: typeof mountDokuWikiEditor;
    getMountedDokuWikiEditor: typeof getMountedDokuWikiEditor;
    startDokuWikiPage: typeof startDokuWikiPage;
    readDokuWikiConfig: typeof readDokuWikiConfig;
}

export interface Cm6RuntimeOptions {
    readonly embeddedLanguageBaseUrl?: string;
    readonly embeddedLanguageImportModule?: EmbeddedLanguageImport;
    readonly embeddedLanguageMaxRetries?: number;
}

/**
 * Exposes the CM6 building blocks, textarea adapter, and DokuWiki bridge.
 *
 * The runtime factory itself is side-effect free. The browser bundle also
 * bootstraps the page integration after DOM readiness when DokuWiki provides
 * JSINFO.plugin_codemirror6.
 */
export function createCm6Runtime(options: Cm6RuntimeOptions = {}): Cm6Runtime {
    const embeddedLanguageRegistry = createEmbeddedLanguageRegistry({
        assetBaseUrl: options.embeddedLanguageBaseUrl,
        importModule: options.embeddedLanguageImportModule,
        maxRetries: options.embeddedLanguageMaxRetries,
    } satisfies EmbeddedLanguageRegistryOptions);
    return {
        version: "phase-13-settings-and-static-highlight",
        embeddedLanguageRegistry,
        EditorView,
        StreamLanguage,
        syntaxTree,
        dokuWikiDefaultTheme,
        dokuWikiThemeNames,
        dokuWikiThemes,
        dokuWikiTheme,
        dokuWikiFontSize,
        dokuWikiScrollbar,
        dokuWikiHighlightStyle,
        dokuWikiHighlighting,
        dokuWikiLightTheme,
        dokuWikiStyleNames,
        dokuWikiTokenTable,
        createState(documentText = "", extension?: Extension): EditorState {
            return EditorState.create({
                doc: documentText,
                extensions: [history(), extension ?? []],
            });
        },
        createEditor,
        mountTextArea,
        getMountedTextAreaAdapter,
        createTextareaEditorPort,
        installDokuWikiBridge,
        mountDokuWikiEditor,
        getMountedDokuWikiEditor,
        startDokuWikiPage,
        readDokuWikiConfig,
        createEditorSettings,
        createDokuWikiSettingsMenu,
        createDokuWikiPageCompletion,
        createDokuWikiPageCompletionSource,
        readDokuWikiSettings,
        validateDokuWikiSetting,
        loadDokuWikiKeymap,
        dokuWikiSettingNames,
        dokuWikiSettingDefinitions,
        dokuWikiSettingMenuOrder,
        dokuWikiFontSizes,
        dokuWikiKeymapNames,
        createEmbeddedLanguageRegistry,
        createEmbeddedLanguageHighlighting,
        createStaticCodeHighlighter,
        highlightEmbeddedBlock,
        highlightEmbeddedDocument,
        highlightStaticCodeBlocks,
        scanEmbeddedCodeBlocks,
        createDokuWikiParserWithEmbeddedRegistry(config = {}) {
            return createDokuWikiParser({
                ...config,
                ...embeddedLanguageRegistry.parserCallbacks(),
            });
        },
        createDokuWikiLanguageWithEmbeddedRegistry(config = {}) {
            return createDokuWikiLanguage({
                ...config,
                ...embeddedLanguageRegistry.parserCallbacks(),
            });
        },
        dokuWiki,
        createDokuWikiLanguage,
        createDokuWikiParser,
        createDokuWikiPluginSyntax: createPluginSyntax,
        dokuWikiPluginSyntaxModules: pluginSyntaxModules,
    };
}

export {
    createTextareaEditorPort,
    createEditor,
    getMountedTextAreaAdapter,
    installDokuWikiBridge,
    mountTextArea,
    mountDokuWikiEditor,
    getMountedDokuWikiEditor,
    readDokuWikiConfig,
    createEmbeddedLanguageHighlighting,
    createStaticCodeHighlighter,
    createEmbeddedLanguageRegistry,
    highlightEmbeddedBlock,
    highlightEmbeddedDocument,
    highlightStaticCodeBlocks,
    scanEmbeddedCodeBlocks,
    dokuWiki,
    createDokuWikiLanguage,
    createDokuWikiParser,
    createDokuWikiPageCompletion,
    createDokuWikiPageCompletionSource,
    createPluginSyntax,
    pluginSyntaxModules,
    dokuWikiDefaultTheme,
    dokuWikiThemeNames,
    dokuWikiThemes,
    dokuWikiTheme,
    dokuWikiFontSize,
    dokuWikiScrollbar,
    dokuWikiHighlightStyle,
    dokuWikiHighlighting,
    dokuWikiLightTheme,
    dokuWikiStyleNames,
    dokuWikiTokenTable,
    autoStartDokuWikiPage,
    startDokuWikiPage,
};
export type {
    EditorController,
    TextareaAdapter,
    TextareaAdapterOptions,
    DokuWikiPage,
    DokuWikiParserConfig,
    DokuWikiPageIntegration,
    DokuWikiPageIntegrationOptions,
};
export {
    embeddedLanguageKeys,
    embeddedLanguageSpecs,
    lookupEmbeddedLanguage,
} from "./language/embedded/aliases";
export type {
    EmbeddedLanguageSpec,
    EmbeddedProviderKind,
} from "./language/embedded/aliases";
export type {
    EmbeddedLanguageLoadResult,
    EmbeddedLanguageRegistry,
    EmbeddedLanguageRegistryOptions,
    EmbeddedLanguageStatus,
} from "./language/embedded/language-registry";
export {
    createDokuWikiSettingsMenu,
    createEditorSettings,
    dokuWikiFontSizes,
    dokuWikiKeymapNames,
    dokuWikiSettingDefinitions,
    dokuWikiSettingMenuOrder,
    dokuWikiSettingNames,
    loadDokuWikiKeymap,
    readDokuWikiSettings,
    validateDokuWikiSetting,
};
export type {
    DokuWikiCookieStore,
    DokuWikiKeymapName,
    DokuWikiSettingName,
    DokuWikiSettingValues,
    EditorSettingsChange,
    EditorSettingsController,
    EditorSettingsOptions,
    KeymapLoader,
    KeymapState,
} from "./editor/settings";
export type {
    DokuWikiPageCompletionOptions,
} from "./editor/page-completion";
export type {
    StaticCodeHighlightingOptions,
    StaticCodeHighlightingResult,
    StaticCodeHighlighter,
} from "./language/embedded/highlighter";

if (typeof window !== "undefined" && typeof document !== "undefined") {
    const start = (): void => {
        try {
            autoStartDokuWikiPage();
        } catch (error) {
            console.error("CodeMirror page integration failed", error);
        }
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, {once: true});
    } else {
        start();
    }
}
