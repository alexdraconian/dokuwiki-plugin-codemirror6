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
import type { LanguageSupport } from "@codemirror/language";

import type { EmbeddedMode } from "../dokuwiki/token-types";

export interface EmbeddedProviderSpan {
    readonly classes: string;
    readonly from: number;
    readonly to: number;
}

export interface EmbeddedProviderModule {
    readonly getLegacyMode?: (
        providerKey: string,
        options?: Readonly<Record<string, unknown>>,
    ) => EmbeddedMode | null;
    readonly getLanguageSupport?: (
        providerKey: string,
        options?: Readonly<Record<string, unknown>>,
    ) => LanguageSupport | null;
    readonly getHighlighter?: (
        providerKey: string,
        options?: Readonly<Record<string, unknown>>,
    ) => ((source: string) => readonly EmbeddedProviderSpan[]) | null;
}
