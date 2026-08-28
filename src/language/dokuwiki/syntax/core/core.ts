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
import type { StringStream } from "@codemirror/language";

import type { DokuWikiParserConfig } from "../../stream-parser";
import {
    emailLinkRegExp,
    externalLinkRegExp,
    fileLinkRegExp,
    wordsRegExp,
} from "../../helpers";
import type {
    DokuWikiParserState,
    SyntaxDeclaration,
    TokenContext,
} from "../../token-types";

function declaration(sort: number, mode: SyntaxDeclaration["mode"]): SyntaxDeclaration {
    return {sort, mode};
}

export function createCoreSyntax(
    parserConfig: DokuWikiParserConfig,
): SyntaxDeclaration[] {
    const codeToken = (
        stream: StringStream,
        state: DokuWikiParserState,
        context?: TokenContext,
    ): string | null | undefined => {
        if (state.innerMode) {
            return undefined;
        }

        if (stream.match(">")) {
            context?.enterEmbeddedMode(state.codeLang);
            state.codeLang = null;
            state.codeFilename = false;
            return tokenStyles(state, "tag");
        }

        if (stream.match(/^\s+/)) {
            return tokenStyles(state);
        }

        if (stream.match(/^[^\s>]+/)) {
            let style: string;
            if (!state.codeLang) {
                state.codeLang = stream.current();
                style = parserConfig.validLang(state.codeLang)
                    ? "keyword"
                    : "error";
            } else if (!state.codeFilename) {
                state.codeFilename = true;
                style = "string";
            } else {
                style = "error";
            }
            return tokenStyles(state, style);
        }
        return undefined;
    };

    const declarations: SyntaxDeclaration[] = [
        declaration(0, {
            name: "base",
            allowedTypes: [
                "container", "baseonly", "formatting", "substition",
                "protected", "disabled",
            ],
        }),
        declaration(10, {
            name: "listblock",
            type: "container",
            allowedTypes: ["formatting", "substition", "disabled", "protected"],
            entries: [
                {sol: true, match: /^ {2,}[\-*]/, style: "def"},
                {sol: true, match: /^\t{1,}[\-*]/, style: "def"},
            ],
            patterns: [
                {sol: true, match: /^ {2,}[\-*]/, style: "def"},
                {sol: true, match: /^\t{1,}[\-*]/, style: "def"},
                {sol: true, exit: true},
            ],
        }),
        declaration(20, {
            name: "preformatted",
            type: "protected",
            entries: [
                {sol: true, match: /^  (?![\*-])/},
                {sol: true, match: /^\t(?![\*-])/},
            ],
            patterns: [
                {sol: true, match: "  "},
                {sol: true, match: "\t"},
                {sol: true, exit: true},
            ],
            style: "string",
        }),
        declaration(30, {
            name: "notoc",
            type: "substition",
            entries: [{match: "~~NOTOC~~", exit: true}],
            style: "meta",
        }),
        declaration(40, {
            name: "nocache",
            type: "substition",
            entries: [{match: "~~NOCACHE~~", exit: true}],
            style: "meta",
        }),
        declaration(50, {
            name: "header",
            type: "baseonly",
            entries: [{match: /^[ \t]*={2}.+={2,}[ \t]*$/, exit: true}],
            style: "header",
        }),
        declaration(60, {
            name: "table",
            type: "container",
            allowedTypes: ["formatting", "substition", "disabled", "protected"],
            entries: [
                {sol: true, match: "^", style: "def"},
                {sol: true, match: "|", style: "def"},
            ],
            patterns: [
                {match: "^", style: "def"},
                {match: "|", style: "def"},
                {match: /^[\t ]*:::[\t ]*(?=[|^])/, style: "def"},
                {match: /^[\t ]+/},
                {sol: true, exit: true},
            ],
        }),
        declaration(70, {
            name: "strong",
            type: "formatting",
            allowedTypes: ["formatting", "substition", "disabled"],
            entries: [{match: "**"}],
            patterns: [{match: "**", exit: true}],
            style: "strong",
        }),
        declaration(80, {
            name: "emphasis",
            type: "formatting",
            allowedTypes: ["formatting", "substition", "disabled"],
            entries: [{match: /^\/\/(?=[^\x00]*[^:])/}],
            patterns: [{match: "//", exit: true}],
            style: "em",
        }),
        declaration(90, {
            name: "underline",
            type: "formatting",
            allowedTypes: ["formatting", "substition", "disabled"],
            entries: [{match: "__"}],
            patterns: [{match: "__", exit: true}],
            style: "underline",
        }),
        declaration(100, {
            name: "monospace",
            type: "formatting",
            allowedTypes: ["formatting", "substition", "disabled"],
            entries: [{match: "''"}],
            patterns: [{match: "''", exit: true}],
            style: "quote",
        }),
        declaration(110, {
            name: "subscript",
            type: "formatting",
            allowedTypes: ["formatting", "substition", "disabled"],
            entries: [{match: "<sub>", style: "tag"}],
            patterns: [{match: "</sub>", exit: true, style: "tag"}],
        }),
        declaration(120, {
            name: "superscript",
            type: "formatting",
            allowedTypes: ["formatting", "substition", "disabled"],
            entries: [{match: "<sup>", style: "tag"}],
            patterns: [{match: "</sup>", exit: true, style: "tag"}],
        }),
        declaration(130, {
            name: "deleted",
            type: "formatting",
            allowedTypes: ["formatting", "substition", "disabled"],
            entries: [{match: "<del>", style: "tag"}],
            patterns: [{match: "</del>", exit: true, style: "tag"}],
        }),
        declaration(140, {
            name: "linebreak",
            type: "substition",
            entries: [{match: /^\\\\(?:[ \t]|$)/, exit: true}],
            style: "tag",
        }),
        declaration(150, {
            name: "footnote",
            type: "formatting",
            allowedTypes: ["container", "formatting", "substition", "protected", "disabled"],
            entries: [{match: "((", style: "tag"}],
            patterns: [{match: "))", exit: true, style: "tag"}],
        }),
        declaration(160, {
            name: "hr",
            type: "container",
            entries: [{sol: true, match: /^[ \t]*-{4,}[ \t]*$/, exit: true}],
            style: "hr",
        }),
        declaration(170, {
            name: "unformatted",
            type: "disabled",
            entries: [{match: "<nowiki>", style: "tag"}],
            patterns: [{match: "</nowiki>", exit: true, style: "tag"}],
        }),
        declaration(170, {
            name: "unformattedalt",
            type: "disabled",
            entries: [{match: "%%"}],
            patterns: [{match: "%%", exit: true}],
            style: "string",
        }),
        declaration(180, {
            name: "php",
            type: "protected",
            entries: [{match: "<php>", style: "tag", lang: "php"}],
            patterns: [{match: "</php>", exit: true, style: "tag"}],
        }),
        declaration(180, {
            name: "phpblock",
            type: "protected",
            entries: [{match: "<PHP>", style: "tag", lang: "php"}],
            patterns: [{match: "</PHP>", exit: true, style: "tag"}],
        }),
        declaration(190, {
            name: "html",
            type: "protected",
            entries: [{match: "<html>", style: "tag", lang: "html"}],
            patterns: [{match: "</html>", exit: true, style: "tag"}],
        }),
        declaration(190, {
            name: "htmlblock",
            type: "protected",
            entries: [{match: "<HTML>", style: "tag", lang: "html"}],
            patterns: [{match: "</HTML>", exit: true, style: "tag"}],
        }),
        declaration(200, {
            name: "code",
            type: "protected",
            entries: [{match: /^<code(?=\s|>|$)/, style: "tag"}],
            patterns: [{match: "</code>", exit: true, style: "tag"}],
            token: codeToken,
        }),
        declaration(210, {
            name: "file",
            type: "protected",
            entries: [{match: /^<file(?=\s|>|$)/, style: "tag"}],
            patterns: [{match: "</file>", exit: true, style: "tag"}],
            token: codeToken,
        }),
        declaration(220, {
            name: "quote",
            type: "container",
            // Preserve the original allowedTypess typo; the CM5 mode did too.
            allowedTypess: ["formatting", "substition", "disabled", "protected"],
            entries: [{sol: true, match: /^>{1,}/, style: "def"}],
            patterns: [
                {sol: true, match: /^>{1,}/, style: "def"},
                {sol: true, exit: true},
            ],
        }),
    ];

    if (parserConfig.smileys.length > 0) {
        declarations.push(declaration(230, {
            name: "smiley",
            type: "substition",
            entries: [{
                behind: /\B$/,
                match: wordsRegExp(parserConfig.smileys, "(?=\\W|$)"),
                exit: true,
            }],
            style: "keyword",
        }));
    }

    if (parserConfig.acronyms.length > 0) {
        declarations.push(declaration(240, {
            name: "acronym",
            type: "substition",
            entries: [{
                behind: /\B$/,
                match: wordsRegExp(parserConfig.acronyms, "(?=\\W|$)"),
                exit: true,
            }],
            style: "keyword",
        }));
    }

    if (parserConfig.entities.length > 0) {
        declarations.push(declaration(260, {
            name: "entity",
            type: "substition",
            entries: [{match: wordsRegExp(parserConfig.entities), exit: true}],
            style: "keyword",
        }));
    }

    declarations.push(
        declaration(270, {
            name: "multipluentity",
            type: "substition",
            entries: [{behind: /\B$/, match: /^(?:[1-9]|\d{2,})(?=[xX]\d+\b)/}],
            patterns: [
                {match: /^[xX]/, style: "keyword"},
                {match: /^\d+\b/, exit: true},
            ],
        }),
    );

    if (parserConfig.camelcase) {
        declarations.push(declaration(290, {
            name: "camelcaselink",
            type: "substition",
            // Preserve mode.js's entry/entries typo as a compatibility rule.
            entry: [{
                behind: /\B$/,
                match: /^[A-Z]+[a-z]+[A-Z][A-Za-z]*\b/,
                exit: true,
            }],
            style: "link",
        }));
    }

    declarations.push(
        declaration(300, {
            name: "internallink",
            type: "substition",
            entries: [{match: "[["}],
            token: (stream, state) => {
                let style: string | undefined;
                if (stream.match("]]")) {
                    state.current = state.stack.pop() as typeof state.current;
                    state.linkTitle = false;
                } else if (!state.linkTitle && stream.match("|")) {
                    state.linkTitle = true;
                } else {
                    stream.next();
                    style = state.linkTitle ? "string" : "link";
                }
                return tokenStyles(state, style);
            },
        }),
        declaration(310, {
            name: "rss",
            type: "substition",
            entries: [{match: /{{rss>/, style: "tag"}],
            patterns: [{match: "}}", exit: true, style: "tag"}],
        }),
        declaration(320, {
            name: "media",
            type: "substition",
            entries: [{match: /^\{\{ */}],
            token: (stream, state) => {
                let style: string | undefined;
                if (stream.match(/^ *\}\}/)) {
                    state.current = state.stack.pop() as typeof state.current;
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
        declaration(330, {
            name: "externallink",
            type: "substition",
            entries: [{
                behind: /\B$/,
                match: externalLinkRegExp(parserConfig.schemes),
                exit: true,
            }],
            style: "link",
        }),
        declaration(340, {
            name: "emaillink",
            type: "substition",
            entries: [{match: emailLinkRegExp(), exit: true}],
            style: "link",
        }),
        declaration(350, {
            name: "windowssharelink",
            type: "substition",
            entries: [{match: /^\\\\\w+?(?:\\[\w-$]+)+/, exit: true}],
            style: "link",
        }),
        declaration(360, {
            name: "filelink",
            type: "substition",
            entries: [{
                behind: /\B$/,
                match: fileLinkRegExp(),
                exit: true,
            }],
            style: "link",
        }),
    );

    return declarations;
}
function tokenStyles(state: DokuWikiParserState, style?: string): string | null {
    const styles = state.stack
        .map((mode) => mode.style)
        .filter((value): value is string => Boolean(value));
    if (state.current.style) {
        styles.push(state.current.style);
    }
    if (style) {
        styles.push(style);
    }
    return styles.join(" ") || null;
}
