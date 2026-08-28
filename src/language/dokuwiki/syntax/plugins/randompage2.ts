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

export const randompage2Syntax: SyntaxModule = {
    plugin: "randompage2",
    rules: [
        syntaxRule(158, {
            name: "randompage2",
            type: "formatting",
            allowedTypes: ["formatting", "substition", "disabled"],
            entries: [{match: "<randompage_link>", style: "tag"}],
            patterns: [{match: "</randompage_link>", exit: true, style: "tag"}],
        }),
    ],
};
