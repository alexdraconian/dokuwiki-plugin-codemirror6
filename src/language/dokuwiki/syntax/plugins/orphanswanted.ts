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

const orphanswantedKeywords = wordsRegExp(["orphans", "wanted", "valid", "all"], "");

export const orphanswantedSyntax: SyntaxModule = {
    plugin: "orphanswanted",
    rules: [
        syntaxRule(990, {
            name: "orphanswanted",
            type: "substition",
            entries: [{match: /~~ORPHANSWANTED:/, style: "meta"}],
            token: (stream, state) => {
                let style: string | undefined;
                if (stream.match(/^~~/)) {
                    state.current = state.stack.pop() as SyntaxMode;
                    state.temp.is_link = false;
                    style = "meta";
                } else if (stream.match("!")) {
                    state.temp.is_link = true;
                } else if (state.temp.is_link) {
                    stream.next();
                    style = "string";
                } else if (stream.match(orphanswantedKeywords)) {
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
