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
import type {SyntaxDeclaration, SyntaxModule} from "../../token-types";
import {adhoctagsSyntax} from "./adhoctags";
import {blockquoteSyntax} from "./blockquote";
import {bootswrapperSyntax} from "./bootswrapper";
import {changesSyntax} from "./changes";
import {colorSyntax} from "./color";
import {commentSyntax} from "./comment";
import {exttab3Syntax} from "./exttab3";
import {fontsize2Syntax} from "./fontsize2";
import {iconsSyntax} from "./icons";
import {imageboxSyntax} from "./imagebox";
import {includeSyntax} from "./include";
import {infoSyntax} from "./info";
import {mathjaxSyntax} from "./mathjax";
import {numberedheadingsSyntax} from "./numberedheadings";
import {numberofSyntax} from "./numberof";
import {orphanswantedSyntax} from "./orphanswanted";
import {pageredirectSyntax} from "./pageredirect";
import {randompage2Syntax} from "./randompage2";
import {refnotesSyntax} from "./refnotes";
import {structSyntax} from "./struct";
import {vshareSyntax} from "./vshare";

/**
 * Plugin modules are listed in the same order as mode.js declarations.
 * createSyntaxRegistry then applies numeric priority and stable tie order.
 */
export const pluginSyntaxModules: readonly SyntaxModule[] = [
    pageredirectSyntax,
    numberofSyntax,
    includeSyntax,
    exttab3Syntax,
    bootswrapperSyntax,
    blockquoteSyntax,
    refnotesSyntax,
    structSyntax,
    infoSyntax,
    fontsize2Syntax,
    colorSyntax,
    randompage2Syntax,
    vshareSyntax,
    iconsSyntax,
    imageboxSyntax,
    orphanswantedSyntax,
    mathjaxSyntax,
    changesSyntax,
    adhoctagsSyntax,
    commentSyntax,
    numberedheadingsSyntax,
];

export function createPluginSyntax(
    plugins: readonly string[] = [],
): SyntaxDeclaration[] {
    const installed = new Set(plugins);
    return pluginSyntaxModules
        .filter((module) =>
            module.enabled !== false && installed.has(module.plugin))
        .flatMap((module) => module.rules);
}
