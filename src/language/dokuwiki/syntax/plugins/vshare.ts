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

const vshareProviders = [
    "5min", "archiveorg", "bambuser", "bliptv", "break", "clipfish",
    "dailymotion", "gtrailers", "metacafe", "myspacetv", "odysee",
    "rcmovie", "scivee", "twitchtv", "slideshare", "ustream", "veoh",
    "viddler", "vimeo", "youtube",
];

export const vshareSyntax: SyntaxModule = {
    plugin: "vshare",
    rules: [
        syntaxRule(159, {
            name: "vshare",
            type: "substition",
            entries: [{
                match: new RegExp("\\{\\{ ?(" + vshareProviders.join("|") + ")>"),
                style: "tag",
            }],
            token: (stream, state) => {
                let style: string | undefined;
                if (stream.match(/^\}\}/)) {
                    state.current = state.stack.pop() as SyntaxMode;
                    state.temp.is_link = false;
                    state.temp.is_string = false;
                    style = "tag";
                } else if (stream.match("|")) {
                    state.temp.is_link = false;
                    state.temp.is_string = true;
                } else if (!state.temp.is_string && stream.match(/[&?]/)) {
                    state.temp.is_link = true;
                } else if (state.temp.is_link) {
                    stream.next();
                    style = "keyword";
                } else {
                    stream.next();
                    style = state.temp.is_string ? "string" : "link";
                }
                return tokenStyles(state, style);
            },
        }),
    ],
};
