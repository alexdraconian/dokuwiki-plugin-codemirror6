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
import type { IndentContext, StringStream } from "@codemirror/language";

export type SyntaxMatch = string | RegExp;

export interface SyntaxPattern {
    readonly behind?: RegExp;
    readonly exit?: boolean;
    readonly lang?: string;
    readonly match?: SyntaxMatch;
    readonly push?: SyntaxMode;
    readonly sol?: boolean;
    readonly style?: string;
}

export interface TokenContext {
    readonly enterEmbeddedMode: (lang: string | null) => void;
}

export interface EmbeddedMode {
    readonly blankLine?: (state: unknown, indentUnit: number) => void;
    readonly copyState?: (state: unknown) => unknown;
    readonly indent?: (
        state: unknown,
        textAfter: string,
        context: IndentContext,
    ) => number | null;
    readonly startState?: (indentUnit?: number) => unknown;
    readonly token: (stream: StringStream, state: unknown) => string | null | undefined;
    readonly blockCommentStart?: string;
    readonly blockCommentEnd?: string;
    readonly lineComment?: string;
    readonly electricChars?: string;
    readonly electricInput?: RegExp;
}

export interface SyntaxMode {
    readonly name: string;
    readonly allowedTypes?: readonly string[];
    readonly allowedTypess?: readonly string[];
    allowedModes?: SyntaxMode[];
    readonly entries?: readonly SyntaxPattern[];
    readonly entry?: readonly SyntaxPattern[];
    readonly patterns?: readonly SyntaxPattern[];
    readonly style?: string;
    readonly token?: TokenFunction;
    readonly type?: string;
}

export interface SyntaxDeclaration {
    readonly sort: number;
    readonly mode: SyntaxMode;
}


export interface SyntaxModule {
    readonly plugin: string;
    readonly rules: readonly SyntaxDeclaration[];
    readonly enabled?: boolean;
    readonly disabledReason?: string;
}
export interface DokuWikiParserState {
    codeFilename: boolean;
    codeLang: string | null;
    current: SyntaxMode;
    exit: boolean;
    innerMode: EmbeddedMode | null;
    innerState: unknown;
    linkParam: boolean | null;
    linkTitle: boolean;
    stack: SyntaxMode[];
    temp: Record<string, unknown>;
}

export type TokenFunction = (
    stream: StringStream,
    state: DokuWikiParserState,
    context?: TokenContext,
) => string | null | undefined;
