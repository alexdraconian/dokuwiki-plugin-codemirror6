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
export interface DokuWikiConfig {
    readonly acronyms: readonly string[];
    readonly baseURL: string;
    readonly camelcase: boolean;
    readonly codesyntax: boolean;
    readonly entities: readonly string[];
    readonly iconURL: string;
    readonly nativeeditor: boolean;
    readonly pageautocomplete: boolean;
    readonly pageautocompleteEndpoint: string;
    readonly pageautocompleteCall: string;
    readonly pageautocompleteNamespace: string;
    readonly pageautocompleteLimit: number;
    readonly plugins: readonly string[];
    readonly schemes: readonly string[];
    readonly smileys: readonly string[];
    readonly usenativescroll: boolean;
    readonly autoheight: boolean;
    readonly version: string;
}

export interface DokuWikiPage {
    readonly pageid: string;
    readonly title: string;
    readonly kind?: "page" | "namespace";
}

interface PluginConfigRecord {
    readonly acronyms?: unknown;
    readonly baseURL?: unknown;
    readonly camelcase?: unknown;
    readonly codesyntax?: unknown;
    readonly entities?: unknown;
    readonly iconURL?: unknown;
    readonly nativeeditor?: unknown;
    readonly pageautocomplete?: unknown;
    readonly pageautocompleteEndpoint?: unknown;
    readonly pageautocompleteCall?: unknown;
    readonly pageautocompleteNamespace?: unknown;
    readonly pageautocompleteLimit?: unknown;
    readonly pageid?: unknown;
    readonly title?: unknown;
    readonly plugins?: unknown;
    readonly schemes?: unknown;
    readonly smileys?: unknown;
    readonly usenativescroll?: unknown;
    readonly autoheight?: unknown;
    readonly version?: unknown;
}

function record(value: unknown): PluginConfigRecord {
    return value && typeof value === "object" ? value as PluginConfigRecord : {};
}

function strings(value: unknown): readonly string[] {
    return Object.freeze(Array.isArray(value) ? value.filter(
        (item): item is string => typeof item === "string",
    ) : []);
}

function booleanValue(value: unknown): boolean {
    return value === true || value === 1 || value === "1";
}

function stringValue(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function positiveInteger(value: unknown, fallback: number): number {
    const number = typeof value === "number" ? value :
        typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) && number > 0 ?
        Math.min(50, Math.floor(number)) : fallback;
}

export function readDokuWikiConfig(source: unknown): DokuWikiConfig {
    const root = record(source);
    const pluginRoot = root as {plugin_codemirror6?: unknown; plugin_codemirror?: unknown};
    const plugin = record(pluginRoot.plugin_codemirror6 ?? pluginRoot.plugin_codemirror);
    return Object.freeze({
        acronyms: strings(plugin.acronyms),
        baseURL: stringValue(plugin.baseURL),
        camelcase: booleanValue(plugin.camelcase),
        codesyntax: booleanValue(plugin.codesyntax),
        entities: strings(plugin.entities),
        iconURL: stringValue(plugin.iconURL),
        nativeeditor: booleanValue(plugin.nativeeditor),
        pageautocomplete: booleanValue(plugin.pageautocomplete),
        pageautocompleteEndpoint: stringValue(plugin.pageautocompleteEndpoint),
        pageautocompleteCall: stringValue(plugin.pageautocompleteCall),
        pageautocompleteNamespace: stringValue(plugin.pageautocompleteNamespace),
        pageautocompleteLimit: positiveInteger(plugin.pageautocompleteLimit, 30),
        plugins: strings(plugin.plugins),
        schemes: strings(plugin.schemes),
        smileys: strings(plugin.smileys),
        usenativescroll: booleanValue(plugin.usenativescroll),
        autoheight: booleanValue(plugin.autoheight),
        version: stringValue(plugin.version),
    });
}
