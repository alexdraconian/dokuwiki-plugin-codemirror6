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
import {syntaxRule, tokenStyles} from "../helpers";
import type {SyntaxMode, SyntaxModule} from "../../token-types";

const iconProviders = [
    "icon", "fa", "ra", "glyphicon", "typcn", "mdi", "fl", "fugue",
    "oxygen", "breeze",
];

export const iconsSyntax: SyntaxModule = {
    plugin: "icons",
    rules: [
        syntaxRule(299, {
            name: "icons",
            type: "substition",
            entries: [{
                match: new RegExp("\\{\\{(" + iconProviders.join("|") + ")>"),
                style: "tag",
            }],
            token: (stream, state) => {
                let style: string | undefined;
                if (stream.match(/^\}\}/)) {
                    state.current = state.stack.pop() as SyntaxMode;
                    state.temp.is_attr = false;
                    style = "tag";
                } else if (stream.match(/&|\?/)) {
                    state.temp.is_attr = true;
                    style = "operator";
                } else if (state.temp.is_attr) {
                    stream.next();
                    style = "keyword";
                } else {
                    stream.next();
                    style = "link";
                }
                return tokenStyles(state, style);
            },
        }),
    ],
};
