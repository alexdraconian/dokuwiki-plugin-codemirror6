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
/**
 * DokuWiki represents a selection with absolute JavaScript string offsets.
 * Keeping this type separate makes the UTF-16 contract explicit: CM6
 * document positions use the same offsets, so no code-point conversion is
 * allowed at this boundary.
 */
export interface DokuWikiSelection {
    obj?: unknown;
    start: number;
    end: number;
    getText?: () => string;
    geText?: () => string;
}

export interface AbsoluteSelection {
    readonly start: number;
    readonly end: number;
}

export function orderedSelection(selection: AbsoluteSelection): AbsoluteSelection {
    return selection.start <= selection.end ? selection : {
        start: selection.end,
        end: selection.start,
    };
}

export function selectionText(
    documentText: string,
    selection: AbsoluteSelection,
): string {
    const ordered = orderedSelection(selection);
    const start = Math.max(0, Math.min(documentText.length, ordered.start));
    const end = Math.max(start, Math.min(documentText.length, ordered.end));
    return documentText.slice(start, end);
}
