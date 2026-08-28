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
import {wordsRegExp} from "../../helpers";
import {syntaxRule, tokenStyles} from "../helpers";
import type {SyntaxMode, SyntaxModule} from "../../token-types";

const infoKeywords = wordsRegExp([
    "syntaxmodes", "syntaxtypes", "syntaxplugins", "adminplugins",
    "actionplugins", "rendererplugins", "helperplugins",
    "helpermethods", "datetime",
], "");

export const infoSyntax: SyntaxModule = {
    plugin: "info",
    rules: [
        syntaxRule(155, {
            name: "info",
            type: "substition",
            entries: [{match: /~~INFO:/, style: "meta"}],
            token: (stream, state) => {
                let style: string;
                if (stream.match(/^~~/)) {
                    state.current = state.stack.pop() as SyntaxMode;
                    style = "meta";
                } else if (stream.match(infoKeywords)) {
                    style = "keyword";
                } else {
                    stream.next();
                    style = "error";
                }
                return tokenStyles(state, style);
            },
        }),
    ],
};
