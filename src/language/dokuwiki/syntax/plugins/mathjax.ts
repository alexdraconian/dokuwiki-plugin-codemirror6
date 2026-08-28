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
import {syntaxRule} from "../helpers";
import type {SyntaxModule} from "../../token-types";

export const mathjaxSyntax: SyntaxModule = {
    plugin: "mathjax",
    rules: [
        syntaxRule(65, {
            name: "mathjax_inline",
            type: "protected",
            entries: [{match: "<math>", style: "tag", lang: "latex"}],
            patterns: [{match: "</math>", style: "tag", exit: true}],
        }),
        syntaxRule(65, {
            name: "mathjax_block",
            type: "protected",
            entries: [{match: "<MATH>", style: "tag", lang: "latex"}],
            patterns: [{match: "</MATH>", style: "tag", exit: true}],
        }),
    ],
};
