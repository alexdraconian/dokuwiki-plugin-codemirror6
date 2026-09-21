/*
 * CodeMirror 6 Plugin for DokuWiki
 *
 * Copyright (C) 2026 AlexDraconian.
 * Licensed under the GNU General Public License, version 2 or later.
 * See LICENSE in the project root.
 */
import type {EmbeddedMode} from "../dokuwiki/token-types";

/** Match StreamLanguage's default state copy when a mode has no custom copier. */
export function copyEmbeddedModeState(mode: EmbeddedMode, state: unknown): unknown {
    if (mode.copyState) {
        return mode.copyState(state);
    }
    if (state === null || typeof state !== "object") {
        return state;
    }
    const copy: Record<string, unknown> = {};
    for (const key in state) {
        const value = (state as Record<string, unknown>)[key];
        // Providers may run in another realm, so instanceof Array is insufficient.
        copy[key] = Array.isArray(value) ? value.slice() : value;
    }
    return copy;
}
