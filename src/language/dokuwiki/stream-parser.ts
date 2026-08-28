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
import {
    StreamLanguage,
    type IndentContext,
    type StreamParser,
    type StringStream,
} from "@codemirror/language";

import {
    copyDokuWikiState,
    createDokuWikiState,
    enterEmbeddedMode,
    exitEmbeddedMode,
} from "./state";
import {createSyntaxRegistry, connectSyntaxModes} from "./registry";
import {createCoreSyntax} from "./syntax/core/core";
import {createPluginSyntax} from "./syntax/plugins/registry";
import {dokuWikiTokenTable} from "./highlight";
import type {
    DokuWikiParserState,
    EmbeddedMode,
    SyntaxMatch,
    SyntaxMode,
    SyntaxPattern,
} from "./token-types";

export interface DokuWikiParserConfig {
    readonly acronyms: readonly string[];
    readonly camelcase: boolean;
    readonly entities: readonly string[];
    readonly plugins?: readonly string[];
    readonly schemes: readonly string[];
    readonly smileys: readonly string[];
    readonly validLang: (lang: string) => boolean;
    readonly loadEmbeddedMode?: (lang: string | null) => EmbeddedMode | null;
}

const plainEmbeddedMode: EmbeddedMode = {
    token(stream): null {
        stream.next();
        return null;
    },
};

export function defaultDokuWikiParserConfig(): DokuWikiParserConfig {
    return {
        acronyms: [],
        camelcase: false,
        entities: [],
        plugins: [],
        schemes: [],
        smileys: [],
        validLang: () => false,
    };
}

export function createDokuWikiParser(
    input: Partial<DokuWikiParserConfig> = {},
): StreamParser<DokuWikiParserState> {
    const parserConfig: DokuWikiParserConfig = {
        ...defaultDokuWikiParserConfig(),
        ...input,
        acronyms: input.acronyms ?? [],
        entities: input.entities ?? [],
        plugins: input.plugins ?? [],
        schemes: input.schemes ?? [],
        smileys: input.smileys ?? [],
        validLang: input.validLang ?? (() => false),
    };
    const declarations = [
        ...createCoreSyntax(parserConfig),
        ...createPluginSyntax(parserConfig.plugins),
    ];
    const modes = createSyntaxRegistry(declarations);
    connectSyntaxModes(modes);
    const base = modes[0];
    const loadMode = (lang: string | null): EmbeddedMode =>
        parserConfig.loadEmbeddedMode?.(lang) ?? plainEmbeddedMode;

    const parser: StreamParser<DokuWikiParserState> = {
        name: "doku",
        mergeTokens: false,
        tokenTable: dokuWikiTokenTable,
        startState(): DokuWikiParserState {
            return createDokuWikiState(base);
        },
        copyState: copyDokuWikiState,
        blankLine(state: DokuWikiParserState): void {
            const patterns = state.current.patterns;
            if (patterns) {
                for (const pattern of patterns) {
                    if (pattern.sol && !pattern.match && pattern.exit) {
                        state.exit = true;
                        return;
                    }
                }
            }
            if (state.innerMode?.blankLine) {
                state.innerMode.blankLine(state.innerState, 4);
            }
        },
        indent(state: DokuWikiParserState, textAfter: string, context: IndentContext) {
            return state.innerMode?.indent
                ? state.innerMode.indent(state.innerState, textAfter, context)
                : null;
        },
        token(stream: StringStream, state: DokuWikiParserState): string | null {
            if (state.exit) {
                exitEmbeddedMode(state);
                state.current = state.stack.pop() as SyntaxMode;
                state.exit = false;
            }

            const style = dokuToken(stream, state, loadMode);
            if (!stream.current() && !state.exit) {
                if (state.innerMode) {
                    return state.innerMode.token(stream, state.innerState) ?? null;
                }
                stream.next();
            }
            return style;
        },
    };
    return parser;
}

export function createDokuWikiLanguage(
    config: Partial<DokuWikiParserConfig> = {},
): StreamLanguage<DokuWikiParserState> {
    return StreamLanguage.define(createDokuWikiParser(config));
}

export const dokuWiki = createDokuWikiLanguage();

function dokuToken(
    stream: StringStream,
    state: DokuWikiParserState,
    loadMode: (lang: string | null) => EmbeddedMode,
): string | null {
    const allowed = state.current.allowedModes ?? [state.current];
    let pattern: SyntaxPattern | null = null;
    let style: string | null | undefined;

    for (const allowedMode of allowed) {
        if (pattern) {
            break;
        }
        if (allowedMode === state.current) {
            if (state.current.token) {
                style = state.current.token(stream, state, {
                    enterEmbeddedMode: (lang) => enterEmbeddedMode(state, loadMode, lang),
                });
                if (stream.current()) {
                    return style ?? null;
                }
            }
            pattern = matchPatterns(stream, allowedMode.patterns);
        } else {
            pattern = matchPatterns(stream, allowedMode.entries);
            if (pattern) {
                state.stack.push(state.current);
                state.current = allowedMode;
                if (pattern.lang) {
                    enterEmbeddedMode(state, loadMode, pattern.lang);
                }
                if (pattern.push) {
                    pattern.push.allowedModes = [pattern.push, ...(state.current.allowedModes ?? [])];
                    state.stack.push(state.current);
                    state.current = pattern.push;
                }
            }
        }
    }

    if (pattern?.exit) {
        state.exit = true;
    }
    return pattern ? tokenStyles(state, pattern.style) : tokenStyles(state, style ?? undefined);
}

function matchPatterns(
    stream: StringStream,
    patterns: readonly SyntaxPattern[] | undefined,
): SyntaxPattern | null {
    if (!patterns) {
        return null;
    }
    const behind = stream.string.slice(0, stream.pos);
    for (const pattern of patterns) {
        if (pattern.sol && !stream.sol()) {
            continue;
        }
        if (pattern.behind && !pattern.behind.test(behind)) {
            continue;
        }
        if (pattern.match && !stream.match(pattern.match as SyntaxMatch)) {
            continue;
        }
        return pattern;
    }
    return null;
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
