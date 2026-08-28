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
import type {SyntaxMode, SyntaxModule, TokenFunction} from "../../token-types";

const structMacro = wordsRegExp([
    "%pageid%", "%title%", "%rowid%", "%lastupdate%",
    "%lasteditor%", "%lastsummary%", "$USER$", "$USER.name$",
    "$USER.email$", "$USER.grps$", "$TODAY$", "$ID$", "$PAGE$",
    "$NS$",
], "");

const tableOptions = [
    "schema", "from", "cols", "field", "select", "head", "header",
    "headers", "max", "limit", "sort", "order", "filter", "where",
    "filterand", "and", "filteror", "or", "dynfilters", "summarize",
    "align", "rownumbers", "width", "widths", "csv",
];
const listOptions = [
    "schema", "from", "cols", "select", "head", "header", "headers",
    "max", "limit", "sort", "order", "filter", "where", "filterand",
    "and", "filteror", "or",
];
const cloudOptions = [
    "schema", "from", "tables", "field", "select", "cols", "col",
    "limit", "max", "min", "page", "target", "summarize",
];
const globalOptions = [
    "schema", "from", "head", "header", "headers", "max", "limit",
    "sort", "order", "filter", "where", "filterand", "and", "filteror",
    "or", "dynfilters", "summarize", "align", "width", "widths", "csv",
];

type StructType = "table" | "list" | "cloud" | "global" | "serial";

function getStructToken(type: StructType): TokenFunction {
    const options = type === "table"
        ? tableOptions
        : type === "list"
            ? listOptions
            : type === "cloud"
                ? cloudOptions
                : globalOptions;

    return (stream, state) => {
        let style: string | undefined;
        if (stream.match(/^----/)) {
            state.current = state.stack.pop() as SyntaxMode;
            style = "def";
        } else if (stream.sol() && stream.match(/^.+?(?=:)/)) {
            style = options.indexOf(stream.current()) !== -1 ? "def" : "error";
        } else if (stream.match(structMacro)) {
            style = "keyword";
        } else if (stream.match(/^$$STRUCT\.(.+?)\.(.+?)/)) {
            style = "keyword";
        } else {
            stream.next();
        }
        return tokenStyles(state, style);
    };
}

const structMode = (
    sort: number,
    name: string,
    type: StructType,
): ReturnType<typeof syntaxRule> => syntaxRule(sort, {
    name,
    type: "substition",
    entries: [{
        match: new RegExp("---- *struct *" + type + " *----"),
        style: "def",
    }],
    token: getStructToken(type),
});

export const structSyntax: SyntaxModule = {
    plugin: "struct",
    rules: [
        structMode(151, "struct_cloud", "cloud"),
        structMode(155, "struct_table", "table"),
        structMode(155, "struct_list", "list"),
        structMode(155, "struct_global", "global"),
        structMode(155, "struct_serial", "serial"),
        syntaxRule(315, {
            name: "struct_value",
            type: "substition",
            entries: [{match: "{{$", style: "tag"}],
            patterns: [{match: "}}", exit: true, style: "tag"}],
        }),
    ],
};
