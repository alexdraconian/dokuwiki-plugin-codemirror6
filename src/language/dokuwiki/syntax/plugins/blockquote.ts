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

export const blockquoteSyntax: SyntaxModule = {
    plugin: "blockquote",
    rules: [
        syntaxRule(123, {
            name: "blockquote-cite",
            type: "formatting",
            allowedTypes: [
                "container", "substition", "protected", "disabled", "formatting",
            ],
            entries: [{match: "<cite>", style: "tag"}],
            patterns: [{match: "</cite>", exit: true, style: "tag"}],
        }),
        syntaxRule(123, {
            name: "blockquote-block",
            type: "container",
            allowedTypes: [
                "container", "substition", "protected", "disabled", "formatting",
            ],
            entries: [{match: "<blockquote>", style: "tag"}],
            patterns: [{match: "</blockquote>", exit: true, style: "tag"}],
        }),
        syntaxRule(123, {
            name: "blockquote-block",
            type: "container",
            allowedTypes: [
                "container", "substition", "protected", "disabled", "formatting",
            ],
            entries: [{match: "<blockquote>", style: "tag"}],
            patterns: [{match: "</blockquote>", exit: true, style: "tag"}],
        }),
        syntaxRule(123, {
            name: "blockquote-inline",
            type: "formatting",
            allowedTypes: ["substition", "formatting", "disabled"],
            entries: [{match: "<q>", style: "tag"}],
            patterns: [{match: "</q>", exit: true, style: "tag"}],
        }),
    ],
};
