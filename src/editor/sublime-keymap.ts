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
    addCursorAbove,
    addCursorBelow,
    copyLineDown,
    cursorDocEnd,
    cursorDocStart,
    cursorLineDown,
    cursorLineEnd,
    cursorLineStart,
    cursorLineUp,
    cursorMatchingBracket,
    cursorSubwordBackward,
    cursorSubwordForward,
    defaultKeymap,
    deleteCharBackward,
    deleteLine,
    indentLess,
    insertBlankLine,
    insertNewlineAndIndent,
    moveLineDown,
    moveLineUp,
    redo,
    selectAll,
    selectParentSyntax,
    selectMatchingBracket,
    standardKeymap,
    toggleComment,
    transposeChars,
    undo,
} from "@codemirror/commands";
import {startCompletion} from "@codemirror/autocomplete";
import {
    foldAll,
    foldCode,
    unfoldAll,
    unfoldCode,
} from "@codemirror/language";
import {
    findNext,
    findPrevious,
    openSearchPanel,
    selectNextOccurrence,
    selectSelectionMatches,
} from "@codemirror/search";
import {
    EditorSelection,
    type Extension,
} from "@codemirror/state";
import {
    keymap,
    type EditorView,
    type KeyBinding,
} from "@codemirror/view";

function lineSelection(view: EditorView): boolean {
    const {doc} = view.state;
    const ranges = view.state.selection.ranges.map((range) => {
        const first = doc.lineAt(range.from);
        const last = doc.lineAt(range.to);
        const end = last.to < doc.length ? last.to + 1 : last.to;
        return EditorSelection.range(first.from, end);
    });
    view.dispatch({selection: EditorSelection.create(ranges)});
    return true;
}

function splitSelectionByLine(view: EditorView): boolean {
    const {doc} = view.state;
    const ranges = [] as ReturnType<typeof EditorSelection.range>[];
    for (const range of view.state.selection.ranges) {
        const first = doc.lineAt(range.from).number;
        const lastLine = doc.lineAt(range.to).number;
        for (let number = first; number <= lastLine; number += 1) {
            const line = doc.line(number);
            if (number === lastLine && number !== first && range.to === line.from) {
                continue;
            }
            ranges.push(EditorSelection.range(
                number === first ? range.from : line.from,
                number === lastLine ? range.to : line.to,
            ));
        }
    }
    view.dispatch({selection: EditorSelection.create(ranges)});
    return true;
}

function insertLineBefore(view: EditorView): boolean {
    const changes = view.state.selection.ranges.map((range) => {
        const line = view.state.doc.lineAt(range.head);
        return {from: line.from, to: line.from, insert: "\n"};
    });
    view.dispatch({changes});
    return true;
}

function joinLines(view: EditorView): boolean {
    const {doc} = view.state;
    const changes: {from: number; to: number; insert: string}[] = [];
    for (const range of view.state.selection.ranges) {
        const first = doc.lineAt(range.from).number;
        const last = doc.lineAt(range.to).number;
        for (let number = last; number > first; number -= 1) {
            const previous = doc.line(number - 1);
            const current = doc.line(number);
            changes.push({
                from: previous.to,
                to: current.from,
                insert: " " + current.text.replace(/^\s+/, ""),
            });
        }
    }
    if (changes.length) {
        changes.sort((left, right) => left.from - right.from);
        view.dispatch({changes});
    }
    return true;
}

function deleteToLineEnd(view: EditorView): boolean {
    const changes = view.state.selection.ranges
        .filter((range) => range.empty)
        .map((range) => {
            const line = view.state.doc.lineAt(range.head);
            return {from: range.head, to: line.to};
        });
    if (changes.length) {
        view.dispatch({changes});
    }
    return true;
}

function changeWordCase(view: EditorView, transform: (value: string) => string): boolean {
    const {doc} = view.state;
    const changes = view.state.selection.ranges.map((range) => {
        if (!range.empty) {
            return {from: range.from, to: range.to, insert: transform(doc.sliceString(range.from, range.to))};
        }
        const line = doc.lineAt(range.head);
        const offset = range.head - line.from;
        const before = line.text.slice(0, offset);
        const after = line.text.slice(offset);
        const start = offset - (before.match(/[A-Za-z0-9_]+$/)?.[0].length ?? 0);
        const suffix = after.match(/^[A-Za-z0-9_]*/)?.[0] ?? "";
        const end = offset + suffix.length;
        return {
            from: line.from + start,
            to: line.from + end,
            insert: transform(line.text.slice(start, end)),
        };
    }).filter((change) => change.from !== change.to);
    if (changes.length) {
        view.dispatch({changes});
    }
    return true;
}

function smartBackspace(view: EditorView): boolean {
    const range = view.state.selection.main;
    if (!range.empty) {
        return false;
    }
    const line = view.state.doc.lineAt(range.head);
    const before = view.state.doc.sliceString(line.from, range.head);
    if (/^\s+$/.test(before) && before.length % 2 === 0 && before.length >= 2) {
        view.dispatch({changes: {from: range.head - 2, to: range.head}});
        return true;
    }
    return deleteCharBackward(view);
}

const sublimeKeymap: readonly KeyBinding[] = [
    ...standardKeymap,
    ...defaultKeymap,
    {key: "Shift-Tab", run: indentLess},
    {key: "Shift-Ctrl-k", run: deleteLine},
    {key: "Mod-t", run: transposeChars},
    {key: "Alt-Left", run: cursorSubwordBackward},
    {key: "Alt-Right", run: cursorSubwordForward},
    {key: "Ctrl-Up", run: cursorLineUp},
    {key: "Ctrl-Down", run: cursorLineDown},
    {key: "Mod-l", run: lineSelection},
    {key: "Shift-Mod-l", run: splitSelectionByLine},
    {key: "Escape", run: (view) => {
        view.dispatch({selection: EditorSelection.cursor(view.state.selection.main.head)});
        return true;
    }},
    {key: "Mod-Enter", run: insertBlankLine},
    {key: "Shift-Mod-Enter", run: insertLineBefore},
    {key: "Mod-d", run: selectNextOccurrence},
    {key: "Shift-Mod-Space", run: selectParentSyntax},
    {key: "Shift-Mod-m", run: selectMatchingBracket},
    {key: "Mod-m", run: cursorMatchingBracket},
    {key: "Shift-Mod-Up", run: moveLineUp},
    {key: "Shift-Mod-Down", run: moveLineDown},
    {key: "Mod-/", run: toggleComment},
    {key: "Mod-j", run: joinLines},
    {key: "Shift-Mod-d", run: copyLineDown},
    {key: "Backspace", run: smartBackspace},
    {key: "Mod-k Mod-d", run: selectNextOccurrence},
    {key: "Mod-k Mod-k", run: deleteToLineEnd},
    {key: "Mod-k Mod-u", run: (view) => changeWordCase(view, (value) => value.toUpperCase())},
    {key: "Mod-k Mod-l", run: (view) => changeWordCase(view, (value) => value.toLowerCase())},
    {key: "Mod-k Mod-1", run: foldAll},
    {key: "Mod-k Mod-0", run: unfoldAll},
    {key: "Mod-k Mod-j", run: unfoldAll},
    {key: "Mod-Alt-Up", run: addCursorAbove},
    {key: "Mod-Alt-Down", run: addCursorBelow},
    {key: "Mod-f3", run: selectNextOccurrence},
    {key: "Shift-Mod-f3", run: findPrevious},
    {key: "Alt-f3", run: selectSelectionMatches},
    {key: "Shift-Mod-[", run: foldCode},
    {key: "Shift-Mod-]", run: unfoldCode},
    {key: "Mod-i", run: openSearchPanel},
    {key: "Mod-h", run: openSearchPanel},
    {key: "F3", run: findNext},
    {key: "Shift-F3", run: findPrevious},
    {key: "Alt-/", run: startCompletion},
    {key: "Mod-Home", run: cursorDocStart},
    {key: "Mod-End", run: cursorDocEnd},
    {key: "Mod-a", run: selectAll},
    {key: "Mod-z", run: undo},
    {key: "Shift-Mod-z", run: redo},
    {key: "Mod-u", run: (view) => changeWordCase(view, (value) => value.toUpperCase())},
    {key: "Shift-Mod-u", run: (view) => changeWordCase(view, (value) => value.toLowerCase())},
    {key: "Mod-Shift-k", run: deleteLine},
    {key: "Mod-Shift-Up", run: moveLineUp},
    {key: "Mod-Shift-Down", run: moveLineDown},
    {key: "Enter", run: insertNewlineAndIndent},
];

export const dokuWikiSublimeKeymap = sublimeKeymap;

export function sublimeKeymapExtension(): Extension {
    return keymap.of(sublimeKeymap);
}
