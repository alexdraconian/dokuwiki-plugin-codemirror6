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
import type { SyntaxDeclaration, SyntaxMode } from "./token-types";

/**
 * Sorts declarations exactly like mode.js: numeric priority first, then
 * declaration order for ties. The returned array is fresh for each parser.
 */
export function createSyntaxRegistry(
    declarations: readonly SyntaxDeclaration[],
): SyntaxMode[] {
    return declarations
        .map((declaration, index) => ({declaration, index}))
        .sort((left, right) =>
            left.declaration.sort - right.declaration.sort ||
            left.index - right.index)
        .map(({declaration}) => declaration.mode);
}

export function connectSyntaxModes(modes: SyntaxMode[]): void {
    for (const source of modes) {
        source.allowedModes = [];
        if (source.allowedTypes) {
            for (const destination of modes) {
                if (
                    source === destination ||
                    source.allowedTypes.includes(destination.type ?? "")
                ) {
                    source.allowedModes.push(destination);
                }
            }
        } else {
            source.allowedModes.push(source);
        }
    }
}
