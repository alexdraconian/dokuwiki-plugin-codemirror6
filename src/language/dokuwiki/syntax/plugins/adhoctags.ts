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

const adHocTagsAttrMode: SyntaxMode = {
    name: "adhoctags_attr",
    type: "formatting",
    allowedTypes: [
        "container", "formatting", "baseonly", "substition", "protected", "disabled",
    ],
    entries: [{match: "", style: "string"}],
    token: (stream, state) => {
        let style: string | undefined;
        if (stream.match(">")) {
            state.current = state.stack.pop() as SyntaxMode;
            state.temp.is_ext_attr = false;
            style = "tag";
        } else if (stream.match("]")) {
            state.temp.is_ext_attr = false;
            style = "bracket";
        } else if (stream.match("[")) {
            state.temp.is_ext_attr = true;
            style = "bracket";
        } else if (state.temp.is_ext_attr && stream.match(/[^\]]+(?==)/)) {
            style = "attribute";
        } else if (state.temp.is_ext_attr && stream.match("=")) {
            style = "operator";
        } else if (state.temp.is_ext_attr) {
            stream.next();
            style = "string";
        } else {
            stream.next();
            style = "attribute";
        }
        return tokenStyles(state, style);
    },
};

const adHocTags = [
    "article", "header", "footer", "address", "cite", "time", "dfn", "kbd",
    "samp", "var", "bdi", "bdo", "dl", "dd", "summary", "div", "aside",
    "section", "figure", "figcaption", "q", "abbr", "mark", "strong", "small",
    "em", "h1", "h2", "h3", "h4", "h5", "h6", "dt", "details", "span", "pre",
    "b", "i", "s", "u", "a",
] as const;

function tagRule(tag: string) {
    return syntaxRule(195, {
        name: "adhoctags_" + tag,
        type: "formatting",
        allowedTypes: [
            "container", "formatting", "baseonly", "substition",
            "protected", "disabled",
        ],
        entries: [{
            match: new RegExp("<" + tag + "(?= .+?>|>)"),
            style: "tag",
            push: adHocTagsAttrMode,
        }],
        patterns: [{
            match: "</" + tag + ">",
            exit: true,
            style: "tag",
        }],
    });
}

export const adhoctagsSyntax: SyntaxModule = {
    plugin: "adhoctags",
    rules: [
        ...adHocTags.map(tagRule),
        tagRule("div"),
        tagRule("span"),
    ],
};
