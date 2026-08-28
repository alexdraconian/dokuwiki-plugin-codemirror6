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
import type { DokuWikiSelection } from "./selection";

export interface ToolbarPort {
    getSelection(editor: unknown): DokuWikiSelection;
    pasteText(
        selection: DokuWikiSelection,
        text: string,
        options?: unknown,
    ): void;
}

/**
 * Small typed facade used by toolbar integrations. The toolbar remains owned
 * by DokuWiki; this adapter only preserves its selection and paste calls.
 */
export function createToolbarPort(
    getSelection: (editor: unknown) => DokuWikiSelection,
    pasteText: (
        selection: DokuWikiSelection,
        text: string,
        options?: unknown,
    ) => void,
): ToolbarPort {
    return {getSelection, pasteText};
}
