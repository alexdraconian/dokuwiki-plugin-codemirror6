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

const bootswrapperAttrMode: SyntaxMode = {
    name: "bootswrapper_attr",
    type: "formatting",
    allowedTypes: [
        "container", "formatting", "baseonly", "substition", "protected", "disabled",
    ],
    entries: [{match: "", style: "string"}],
    token: (stream, state) => {
        let style: string | undefined;
        if (stream.match(">")) {
            state.current = state.stack.pop() as SyntaxMode;
            style = "tag";
        } else if (stream.match(/".+?"/)) {
            style = "string";
        } else if (stream.match("=")) {
            style = "operator";
        } else {
            stream.next();
            style = "attribute";
        }
        return tokenStyles(state, style);
    },
};

const bootswrapperTags = [
    "grid", "panelbody", "column", "hidden", "image", "invisible",
    "collapse", "jumbotron", "carousel", "label", "caption", "lead",
    "panel", "nav", "list", "wrapper", "pills", "popover", "progress",
    "bar", "row", "show", "slide", "tabs", "text", "thumbnail",
    "tooltip", "well", "callout", "modal", "pane", "pageheader",
    "accordion", "affix", "alert", "badge", "button",
] as const;

export const bootswrapperSyntax: SyntaxModule = {
    plugin: "bootswrapper",
    rules: [
        syntaxRule(99, {
            name: "bootswrapper_macros",
            type: "substition",
            entries: [{match: /~~(CLEARFIX|PAGEBREAK)~~/, exit: true}],
            style: "meta",
        }),
        ...bootswrapperTags.map((tag) => syntaxRule(195, {
            name: "bootswrapper_" + tag,
            type: "formatting",
            allowedTypes: [
                "container", "formatting", "baseonly", "substition",
                "protected", "disabled",
            ],
            entries: [{
                match: new RegExp("<" + tag + "(?= .+?>|>)"),
                style: "tag",
                push: bootswrapperAttrMode,
            }],
            patterns: [{
                match: "</" + tag + ">",
                style: "tag",
                exit: true,
            }],
        })),
    ],
};
