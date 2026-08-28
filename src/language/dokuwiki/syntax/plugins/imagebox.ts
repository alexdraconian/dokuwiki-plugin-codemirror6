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

export const imageboxSyntax: SyntaxModule = {
    plugin: "imagebox",
    rules: [
        syntaxRule(315, {
            name: "imagebox",
            type: "protected",
            allowedTypes: ["formatting", "substition"],
            entries: [{match: /^\[\{\{ */}],
            token: (stream, state) => {
                let style: string | undefined;
                if (stream.match(/^ *\}\}\]/)) {
                    state.current = state.stack.pop() as SyntaxMode;
                    state.linkParam = false;
                    state.linkTitle = false;
                } else if (state.linkTitle) {
                    style = "string";
                    stream.next();
                } else if (stream.match(/^\s*\|/)) {
                    state.linkTitle = true;
                } else if (state.linkParam) {
                    if (stream.match(/^(?:nolink|direct|linkonly)/)) {
                        style = "keyword";
                    } else if (stream.match(/^(?:nocache|recache)/)) {
                        style = "meta";
                    } else if (stream.match(/^\d+(?:[xX]\d+)?/)) {
                        style = "number";
                    } else if (!stream.match(/^\s+/)) {
                        stream.next();
                        style = "error";
                    }
                } else if (stream.match(/^\?(?=[^\?]*$)/)) {
                    state.linkParam = true;
                } else {
                    stream.next();
                    style = "link";
                }
                return tokenStyles(state, style);
            },
        }),
    ],
};
