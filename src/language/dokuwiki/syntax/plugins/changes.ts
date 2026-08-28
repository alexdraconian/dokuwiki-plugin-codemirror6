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

export const changesSyntax: SyntaxModule = {
    plugin: "changes",
    rules: [
        syntaxRule(50, {
            name: "changes",
            type: "substition",
            entries: [{match: "{{changes>", style: "tag"}],
            token: (stream, state) => {
                let style: string;
                if (stream.match(/^\}\}/)) {
                    state.current = state.stack.pop() as SyntaxMode;
                    style = "tag";
                } else if (stream.match(/&|=/)) {
                    style = "operator";
                } else if (stream.match(/[^&=]+?(?==)/)) {
                    style = "attribute";
                } else {
                    style = "string";
                    stream.next();
                }
                return tokenStyles(state, style);
            },
        }),
    ],
};
