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
import {HighlightStyle, syntaxHighlighting} from "@codemirror/language";
import type {Extension} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {tags} from "@lezer/highlight";

import {dokuWikiTags} from "../language/dokuwiki/highlight";

/**
 * The names are kept byte-for-byte compatible with the CM5 settings cookie.
 * CM6 does not ship the CM5 theme CSS, so these themes preserve each name,
 * light/dark intent, and the recognizable palette rather than promising
 * pixel-perfect reproduction of every old stylesheet.
 */
export const dokuWikiThemeNames = [
    "3024-day",
    "3024-night",
    "abcdef",
    "ambiance",
    "ambiance-mobile",
    "base16-dark",
    "base16-light",
    "bespin",
    "blackboard",
    "cobalt",
    "colorforth",
    "default",
    "dracula",
    "eclipse",
    "elegant",
    "erlang-dark",
    "hopscotch",
    "icecoder",
    "isotope",
    "lesser-dark",
    "liquidbyte",
    "material",
    "mbo",
    "mdn-like",
    "midnight",
    "monokai",
    "neat",
    "neo",
    "night",
    "panda-syntax",
    "paraiso-dark",
    "paraiso-light",
    "pastel-on-dark",
    "railscasts",
    "rubyblue",
    "seti",
    "solarized",
    "the-matrix",
    "tomorrow-night-bright",
    "tomorrow-night-eighties",
    "ttcn",
    "twilight",
    "vibrant-ink",
    "xq-dark",
    "xq-light",
    "yeti",
    "zenburn",
] as const;

export type DokuWikiThemeName = (typeof dokuWikiThemeNames)[number];

interface ThemePalette {
    readonly background: string;
    readonly foreground: string;
    readonly gutter: string;
    readonly activeLine: string;
    readonly selection: string;
    readonly cursor: string;
    readonly dark: boolean;
}

const lightPalette: ThemePalette = {
    background: "#fff",
    foreground: "#000",
    gutter: "#f7f7f7",
    activeLine: "#e8f2ff",
    selection: "#b7d9ff",
    cursor: "#000",
    dark: false,
};

const darkPalette: ThemePalette = {
    background: "#202124",
    foreground: "#e8eaed",
    gutter: "#292a2d",
    activeLine: "#303134",
    selection: "#3c4043",
    cursor: "#fff",
    dark: true,
};

const paletteOverrides: Partial<Record<DokuWikiThemeName, ThemePalette>> = {
    "3024-day": {...lightPalette, background: "#f7f7f7", foreground: "#4a4543"},
    "3024-night": {...darkPalette, background: "#090300", foreground: "#a5a2a2"},
    abcdef: {...darkPalette, background: "#0f192a", foreground: "#def"},
    ambiance: {...darkPalette, background: "#202020", foreground: "#e6e1dc"},
    "ambiance-mobile": {...darkPalette, background: "#202020", foreground: "#e6e1dc"},
    "base16-dark": {...darkPalette, background: "#151515", foreground: "#d0d0d0"},
    "base16-light": {...lightPalette, background: "#f5f5f5", foreground: "#202020"},
    bespin: {...darkPalette, background: "#28211c", foreground: "#9d9b78"},
    blackboard: {...darkPalette, background: "#0c1021", foreground: "#f8f8f8"},
    cobalt: {...darkPalette, background: "#002240", foreground: "#fff"},
    colorforth: {...darkPalette, background: "#232323", foreground: "#f8f8f8"},
    dracula: {...darkPalette, background: "#282a36", foreground: "#f8f8f2"},
    "eclipse": {...lightPalette, background: "#fff", foreground: "#000"},
    "erlang-dark": {...darkPalette, background: "#002b36", foreground: "#839496"},
    hopscotch: {...darkPalette, background: "#322931", foreground: "#b9b5b8"},
    icecoder: {...darkPalette, background: "#1c1c1c", foreground: "#c9c9c9"},
    isotope: {...lightPalette, background: "#f4f4f4", foreground: "#333"},
    "lesser-dark": {...darkPalette, background: "#222", foreground: "#eee"},
    liquidbyte: {...lightPalette, background: "#fff", foreground: "#111"},
    material: {...darkPalette, background: "#263238", foreground: "#eeffff"},
    mbo: {...darkPalette, background: "#2c2c2c", foreground: "#f8f8f2"},
    "mdn-like": {...lightPalette, background: "#fff", foreground: "#000"},
    midnight: {...darkPalette, background: "#0f192a", foreground: "#f8f8f8"},
    monokai: {...darkPalette, background: "#272822", foreground: "#f8f8f2"},
    night: {...darkPalette, background: "#0a001f", foreground: "#fff"},
    "panda-syntax": {...darkPalette, background: "#292a2b", foreground: "#e6e6e6"},
    "paraiso-dark": {...darkPalette, background: "#2f1e2e", foreground: "#a39da6"},
    "paraiso-light": {...lightPalette, background: "#e7e9db", foreground: "#776e71"},
    "pastel-on-dark": {...darkPalette, background: "#211f20", foreground: "#f1f1f0"},
    railscasts: {...darkPalette, background: "#2b2b2b", foreground: "#e6e1dc"},
    rubyblue: {...darkPalette, background: "#112435", foreground: "#e2e2e2"},
    seti: {...darkPalette, background: "#151718", foreground: "#cacecd"},
    solarized: {...darkPalette, background: "#002b36", foreground: "#839496"},
    "the-matrix": {...darkPalette, background: "#000", foreground: "#00ff41"},
    "tomorrow-night-bright": {...darkPalette, background: "#000", foreground: "#eaeaea"},
    "tomorrow-night-eighties": {...darkPalette, background: "#2d2d2d", foreground: "#ccc"},
    ttcn: {...lightPalette, background: "#fff", foreground: "#000"},
    twilight: {...darkPalette, background: "#141414", foreground: "#f8f8f8"},
    "vibrant-ink": {...darkPalette, background: "#1e1e1e", foreground: "#fff"},
    "xq-dark": {...darkPalette, background: "#0f1419", foreground: "#fff"},
    "xq-light": {...lightPalette, background: "#fff", foreground: "#000"},
    yeti: {...lightPalette, background: "#f8f8f8", foreground: "#333"},
    zenburn: {...darkPalette, background: "#3f3f3f", foreground: "#dcdccc"},
};

function paletteFor(name: DokuWikiThemeName): ThemePalette {
    return paletteOverrides[name] ?? lightPalette;
}

/**
 * Light theme values are based on CodeMirror 5's default token CSS. The
 * styles target CM6 highlight tags, never generated CM6 class names.
 */
export const dokuWikiHighlightStyle = HighlightStyle.define([
    {tag: tags.heading, color: "blue", fontWeight: "bold"},
    {tag: tags.definition(tags.variableName), color: "#00c"},
    {tag: tags.strong, fontWeight: "bold"},
    {tag: tags.emphasis, fontStyle: "italic"},
    {tag: dokuWikiTags.underline, textDecoration: "underline"},
    {tag: tags.quote, color: "#090"},
    {tag: tags.tagName, color: "#170"},
    {tag: tags.contentSeparator, color: "#999"},
    {tag: tags.keyword, color: "#708"},
    {tag: tags.link, color: "#00c", textDecoration: "underline"},
    {tag: tags.number, color: "#164"},
    {tag: tags.invalid, color: "#f00", textDecoration: "underline wavy #f00"},
    {tag: tags.operator, color: "#000"},
    {tag: tags.attributeName, color: "#00c"},
    {tag: tags.bracket, color: "#997"},
    {tag: tags.comment, color: "#a50"},
    {tag: tags.meta, color: "#555"},
    {tag: tags.string, color: "#a11"},
]);

export const dokuWikiLightTheme = EditorView.theme({
    "&": {
        color: lightPalette.foreground,
        backgroundColor: lightPalette.background,
    },
    ".cm-content": {
        caretColor: lightPalette.cursor,
    },
    "&.cm-focused .cm-cursor, &.cm-focused .cm-dropCursor": {
        borderLeftColor: lightPalette.cursor,
    },
    ".cm-gutters": {
        backgroundColor: lightPalette.gutter,
        color: "#999",
        border: "none",
    },
    ".cm-activeLine": {
        backgroundColor: lightPalette.activeLine,
    },
    ".cm-selectionBackground, ::selection": {
        backgroundColor: lightPalette.selection,
    },
}, {dark: false});

export const dokuWikiHighlighting = syntaxHighlighting(
    dokuWikiHighlightStyle,
);

export function dokuWikiTheme(name: string): Extension {
    const themeName = (dokuWikiThemeNames as readonly string[]).includes(name) ?
        name as DokuWikiThemeName : "default";
    const palette = paletteFor(themeName);
    return [
        EditorView.theme({
            "&": {
                color: palette.foreground,
                backgroundColor: palette.background,
            },
            ".cm-content": {
                caretColor: palette.cursor,
            },
            "&.cm-focused .cm-cursor, &.cm-focused .cm-dropCursor": {
                borderLeftColor: palette.cursor,
            },
            ".cm-gutters": {
                backgroundColor: palette.gutter,
                color: palette.dark ? "#888" : "#999",
                border: "none",
            },
            ".cm-activeLine": {
                backgroundColor: palette.activeLine,
            },
            ".cm-selectionBackground, ::selection": {
                backgroundColor: palette.selection,
            },
        }, {dark: palette.dark}),
        dokuWikiHighlighting,
    ];
}

export function dokuWikiFontSize(value: string | number): Extension {
    const numeric = typeof value === "number" ? value : Number(value);
    const size = Number.isFinite(numeric) && numeric > 0 ? numeric : 14;
    const fontSize = `${size}px`;
    return EditorView.theme({
        "&": {fontSize},
        ".cm-content, .cm-gutters": {fontSize},
    });
}

export function dokuWikiScrollbar(useNative: boolean): Extension {
    return EditorView.theme({
        ".cm-scroller": {
            overflowY: useNative ? "scroll" : "auto",
        },
    });
}

export const dokuWikiThemes: Readonly<Record<DokuWikiThemeName, Extension>> =
    Object.freeze(Object.fromEntries(dokuWikiThemeNames.map((name) => [
        name,
        dokuWikiTheme(name),
    ])) as Record<DokuWikiThemeName, Extension>);

export const dokuWikiDefaultTheme: Extension = dokuWikiTheme("default");
