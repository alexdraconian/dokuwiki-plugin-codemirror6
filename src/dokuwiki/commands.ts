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
import type { EditorState } from "@codemirror/state";
import type { KeyBinding } from "@codemirror/view";
import { keymap, type EditorView } from "@codemirror/view";

export type DokuWikiIndentKey = "Enter" | "Space" | "Backspace";

export type IsOuterMode = (
    state: EditorState,
    position: number,
) => boolean;

function indentCommand(
    view: EditorView,
    key: DokuWikiIndentKey,
    isOuterMode: IsOuterMode,
): boolean {
    const {state} = view;
    const selection = state.selection.main;
    if (!selection.empty || !isOuterMode(state, selection.head)) {
        return false;
    }

    const line = state.doc.lineAt(selection.head);
    const before = state.sliceDoc(line.from, selection.head);
    const match = /^(  +)([-*] )?/.exec(before);
    if (!match) {
        return false;
    }
    if (key !== "Enter" && selection.head > line.from + match[0].length) {
        return false;
    }

    if (key === "Enter") {
        const isEmptyListItem = Boolean(match[2]) && match[0] === line.text;
        view.dispatch({
            changes: {
                from: isEmptyListItem ? line.from : selection.head,
                to: selection.head,
                insert: "\n" + (isEmptyListItem ? "" : match[0]),
            },
        });
    } else if (key === "Space") {
        view.dispatch({
            changes: {
                from: line.from,
                to: selection.head,
                insert: "  " + before,
            },
        });
    } else {
        const nextBefore = match[1].length >= 4 ? before.slice(2) : "";
        view.dispatch({
            changes: {
                from: line.from,
                to: selection.head,
                insert: nextBefore,
            },
        });
    }
    return true;
}

export function runDokuWikiIndentCommand(
    view: EditorView,
    key: DokuWikiIndentKey,
    isOuterMode: IsOuterMode = () => true,
): boolean {
    return indentCommand(view, key, isOuterMode);
}

export function createDokuWikiKeymap(
    onSaveRequest: () => void,
    isOuterMode: IsOuterMode = () => true,
): ReturnType<typeof keymap.of> {
    const bindings: KeyBinding[] = [
        {
            key: "Enter",
            run: (view) => runDokuWikiIndentCommand(view, "Enter", isOuterMode),
        },
        {
            key: "Space",
            run: (view) => runDokuWikiIndentCommand(view, "Space", isOuterMode),
        },
        {
            key: "Backspace",
            run: (view) => runDokuWikiIndentCommand(view, "Backspace", isOuterMode),
        },
        {
            key: "Mod-Enter",
            run: (view) => {
                onSaveRequest();
                return true;
            },
        },
    ];
    return keymap.of(bindings);
}
