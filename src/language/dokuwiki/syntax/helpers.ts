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
import type {
    DokuWikiParserState,
    SyntaxDeclaration,
    SyntaxMode,
} from "../token-types";

export function syntaxRule(
    sort: number,
    mode: SyntaxMode,
): SyntaxDeclaration {
    return {sort, mode};
}

export function tokenStyles(
    state: DokuWikiParserState,
    style?: string,
): string | null {
    const styles = state.stack
        .map((mode) => mode.style)
        .filter((value): value is string => Boolean(value));
    if (state.current.style) {
        styles.push(state.current.style);
    }
    if (style) {
        styles.push(style);
    }
    return styles.join(" ") || null;
}
