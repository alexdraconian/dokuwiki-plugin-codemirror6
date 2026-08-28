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
import {Tag, tags} from "@lezer/highlight";

/**
 * CM5 DokuWiki token names retained by the StreamParser.
 *
 * The values are intentionally kept as tokenTable entries instead of CSS
 * class names. CM6 can then combine parent and leaf styles in one token.
 */
export const dokuWikiTags = {
    underline: Tag.define(),
} as const;

export const dokuWikiStyleNames = [
    "attribute",
    "bracket",
    "comment",
    "def",
    "em",
    "error",
    "header",
    "hr",
    "keyword",
    "link",
    "meta",
    "number",
    "operator",
    "quote",
    "string",
    "strong",
    "tag",
    "underline",
] as const;

export type DokuWikiStyleName = typeof dokuWikiStyleNames[number];

export const dokuWikiTokenTable: Readonly<
    Record<DokuWikiStyleName, Tag | readonly Tag[]>
> = {
    attribute: tags.attributeName,
    bracket: tags.bracket,
    comment: tags.comment,
    def: tags.definition(tags.variableName),
    em: tags.emphasis,
    error: tags.invalid,
    header: tags.heading,
    hr: tags.contentSeparator,
    keyword: tags.keyword,
    link: tags.link,
    meta: tags.meta,
    number: tags.number,
    operator: tags.operator,
    quote: tags.quote,
    string: tags.string,
    strong: tags.strong,
    tag: tags.tagName,
    underline: dokuWikiTags.underline,
};
