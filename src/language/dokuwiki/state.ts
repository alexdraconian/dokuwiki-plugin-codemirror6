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
import type {
    DokuWikiParserState,
    EmbeddedMode,
    SyntaxMode,
} from "./token-types";

export function createDokuWikiState(base: SyntaxMode): DokuWikiParserState {
    return {
        codeFilename: false,
        codeLang: null,
        current: base,
        exit: false,
        innerMode: null,
        innerState: null,
        linkParam: null,
        linkTitle: false,
        stack: [],
        temp: {},
    };
}

export function copyEmbeddedState(
    mode: EmbeddedMode,
    state: unknown,
): unknown {
    return mode.copyState ? mode.copyState(state) : state;
}

export function copyDokuWikiState(state: DokuWikiParserState): DokuWikiParserState {
    return {
        codeFilename: state.codeFilename,
        codeLang: state.codeLang,
        current: state.current,
        exit: state.exit,
        innerMode: state.innerMode,
        innerState: state.innerMode
            ? copyEmbeddedState(state.innerMode, state.innerState)
            : null,
        linkParam: state.linkParam,
        linkTitle: state.linkTitle,
        stack: state.stack.slice(),
        temp: {},
    };
}

export function enterEmbeddedMode(
    state: DokuWikiParserState,
    loadMode: (lang: string | null) => EmbeddedMode | null,
    lang: string | null,
): void {
    const mode = loadMode(lang);
    state.innerMode = mode;
    state.innerState = mode?.startState ? mode.startState(4) : null;
}

export function exitEmbeddedMode(state: DokuWikiParserState): void {
    state.innerMode = null;
    state.innerState = null;
}
