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
import type {SyntaxModule} from "../../token-types";

/**
 * Kept as an explicit registry entry to document the CM5 block-commented
 * implementation. Passing this plugin name must remain a no-op.
 */
export const numberedheadingsSyntax: SyntaxModule = {
    plugin: "numberedheadings",
    rules: [],
    enabled: false,
    disabledReason: "The CM5 declaration is entirely inside a block comment.",
};
