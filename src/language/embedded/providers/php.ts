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
import {php} from "@codemirror/lang-php";
import {ensureSyntaxTree, syntaxTree} from "@codemirror/language";
import {EditorState} from "@codemirror/state";
import {classHighlighter, highlightTree} from "@lezer/highlight";

import type {EmbeddedProviderModule} from "../provider-types";

const phpSupport = php({plain: true});

function highlightPhp(source: string) {
    const state = EditorState.create({
        doc: source,
        extensions: [phpSupport.extension],
    });
    const tree = ensureSyntaxTree(state, source.length, 5000) ?? syntaxTree(state);
    const spans: {classes: string; from: number; to: number}[] = [];
    highlightTree(tree, classHighlighter, (from, to, classes) => {
        if (from < to) {
            spans.push({classes, from, to});
        }
    });
    return spans;
}

export const embeddedProvider: EmbeddedProviderModule = {
    getHighlighter(providerKey: string) {
        return providerKey === "php" ? highlightPhp : null;
    },
};
