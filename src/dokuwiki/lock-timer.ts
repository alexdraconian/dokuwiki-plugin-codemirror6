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
export interface LockTimer {
    readonly lasttime: Date | null;
    refresh(): void;
}

export interface LockTimerSync {
    update(): boolean;
}

export interface LockTimerSyncOptions {
    readonly timer?: LockTimer;
    readonly sync: () => void;
    readonly now?: () => Date;
    readonly thresholdMs?: number;
}

/**
 * Preserve DokuWiki's change-time lock refresh rule. The textarea is synced
 * before refresh(), exactly as the CM5 bridge did.
 */
export function createLockTimerSync(
    options: LockTimerSyncOptions,
): LockTimerSync {
    const thresholdMs = options.thresholdMs ?? 30000;
    const now = options.now ?? (() => new Date());

    return {
        update(): boolean {
            const timer = options.timer;
            if (!timer) {
                return false;
            }
            if (!timer.lasttime || now().getTime() - timer.lasttime.getTime() <= thresholdMs) {
                return false;
            }
            options.sync();
            timer.refresh();
            return true;
        },
    };
}
