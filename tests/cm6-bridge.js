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
/* jshint node: true, esversion: 2022 */
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var JSDOM = require("jsdom").JSDOM;

var ROOT = path.resolve(__dirname, "..");
var BUNDLE = path.join(ROOT, "dist", "cm6", "scripts.min.js");

function loadRuntime(window) {
    window.console = console;
    window.requestAnimationFrame = window.requestAnimationFrame ||
        function(callback) { return window.setTimeout(callback, 0); };
    window.cancelAnimationFrame = window.cancelAnimationFrame ||
        function(id) { window.clearTimeout(id); };
    var context = vm.createContext(window);
    new vm.Script(fs.readFileSync(BUNDLE, "utf8"), {
        filename: BUNDLE,
    }).runInContext(context);
    return context.DokuWikiCodeMirror6.createCm6Runtime();
}

function createFixture() {
    var dom = new JSDOM(
        "<!doctype html><form id=\"dw__editform\">" +
        "<textarea id=\"wiki__text\" style=\"height: 200px\" wrap=\"off\">" +
        "한😀글\n  - 항목</textarea>" +
        "<button id=\"edbtn__save\" type=\"button\">save</button>" +
        "</form>",
        {pretendToBeVisual: true},
    );
    var window = dom.window;
    var textarea = window.document.getElementById("wiki__text");
    var form = window.document.getElementById("dw__editform");
    var calls = [];

    window.dw_editor = {
        setWrap: function(editor, value) {
            calls.push(["setWrap", editor, value]);
            editor.wrap = value;
        },
        sizeCtl: function(editor, value) {
            calls.push(["sizeCtl", editor, value]);
            editor.style.height = value + "px";
        },
    };
    window.currentHeadlineLevel = function(id) {
        calls.push(["headline", id, textarea.value]);
        return 4;
    };
    window.selection_class = function() {
        this.getText = function() {
            return textarea.value.slice(this.start, this.end);
        };
    };
    window.DWgetSelection = function(editor) {
        calls.push(["fallbackGet", editor]);
        return {obj: editor, start: 10, end: 10};
    };
    window.DWsetSelection = function(selection) {
        calls.push(["fallbackSet", selection]);
    };
    window.pasteText = function(selection, text, options) {
        calls.push(["paste", textarea.value, selection, text, options]);
    };
    window.dw_locktimer = {
        lasttime: new window.Date(0),
        refresh: function() {
            calls.push(["refresh"]);
            this.lasttime = new window.Date(50000);
        },
    };
    window.Date = Date;

    return {
        dom: dom,
        window: window,
        textarea: textarea,
        form: form,
        calls: calls,
        runtime: loadRuntime(window),
    };
}

function dispatchKey(view, key, modifiers) {
    var event = new view.dom.ownerDocument.defaultView.KeyboardEvent("keydown", {
        key: key,
        bubbles: true,
        cancelable: true,
        ctrlKey: Boolean(modifiers && modifiers.ctrlKey),
        metaKey: Boolean(modifiers && modifiers.metaKey),
    });
    view.focus();
    view.contentDOM.dispatchEvent(event);
}

function assertSelection(adapter, expectedStart, expectedEnd) {
    var selection = adapter.getSelection().main;
    assert.strictEqual(selection.from, expectedStart);
    assert.strictEqual(selection.to, expectedEnd);
}

function testBridgeLifecycleAndSelection() {
    var fixture = createFixture();
    var window = fixture.window;
    var textarea = fixture.textarea;
    textarea.setSelectionRange(1, 3, "forward");
    var original = {
        get: window.DWgetSelection,
        set: window.DWsetSelection,
        paste: window.pasteText,
        headline: window.currentHeadlineLevel,
        selectionClass: window.selection_class,
        setWrap: window.dw_editor.setWrap,
        sizeCtl: window.dw_editor.sizeCtl,
    };
    var now = new Date(50000);
    var mounted = fixture.runtime.mountDokuWikiEditor({
        window: window,
        textarea: textarea,
        lockTimer: window.dw_locktimer,
        now: function() { return now; },
    });

    assert.strictEqual(textarea.style.display, "none");
    var selection = window.DWgetSelection(textarea);
    assert.ok(selection instanceof window.selection_class);
    assert.strictEqual(selection.start, 1);
    assert.strictEqual(selection.end, 3);
    assert.strictEqual(selection.geText(), "😀");
    assert.strictEqual(textarea.value, mounted.port.readValue());

    window.DWsetSelection(selection);
    assertSelection(mounted.adapter, 1, 3);
    assert.strictEqual(window.document.activeElement, mounted.adapter.editor.view.contentDOM);

    mounted.adapter.editor.setValue("새😀글");
    var pasteSelection = {obj: textarea, start: 1, end: 3};
    window.pasteText(pasteSelection, "한", {source: "toolbar"});
    assert.strictEqual(mounted.port.readValue(), "새한글");
    assert.strictEqual(fixture.calls[fixture.calls.length - 2][0], "refresh");
    assert.strictEqual(fixture.calls[fixture.calls.length - 1][0], "paste");
    assert.strictEqual(fixture.calls[fixture.calls.length - 1][1], "새😀글");

    mounted.adapter.editor.setValue("내용");
    var headlineResult = window.currentHeadlineLevel("wiki__text");
    assert.strictEqual(headlineResult, 4);
    assert.strictEqual(fixture.calls[fixture.calls.length - 1][0], "headline");
    assert.strictEqual(fixture.calls[fixture.calls.length - 1][2], "내용");

    window.dw_editor.setWrap(textarea, "on");
    assert.ok(mounted.adapter.editor.view.dom.querySelector(".cm-lineWrapping"));
    window.dw_editor.sizeCtl(textarea, 360);
    assert.strictEqual(mounted.adapter.host.style.height, "360px");

    window.dw_locktimer.lasttime = null;
    mounted.adapter.editor.setValue("lock timer pending");
    window.dw_locktimer.lasttime = new Date(50000);

    now = new Date(80001);
    mounted.adapter.editor.setValue("lock refresh");
    assert.strictEqual(textarea.value, "lock refresh");
    assert.strictEqual(fixture.calls.filter(function(call) {
        return call[0] === "refresh";
    }).length, 2);

    mounted.destroy();
    assert.strictEqual(window.DWgetSelection, original.get);
    assert.strictEqual(window.DWsetSelection, original.set);
    assert.strictEqual(window.pasteText, original.paste);
    assert.strictEqual(window.currentHeadlineLevel, original.headline);
    assert.strictEqual(window.selection_class, original.selectionClass);
    assert.strictEqual(window.dw_editor.setWrap, original.setWrap);
    assert.strictEqual(window.dw_editor.sizeCtl, original.sizeCtl);
    assert.strictEqual(textarea.style.display, "");
    fixture.dom.window.close();
}

async function testSubmitSaveAndIndentCommands() {
    var fixture = createFixture();
    var saveCount = 0;
    fixture.window.document.getElementById("edbtn__save").addEventListener(
        "click",
        function() { saveCount += 1; },
    );
    var mounted = fixture.runtime.mountDokuWikiEditor({
        window: fixture.window,
        textarea: fixture.textarea,
        now: function() { return new Date(1000); },
        settings: {cookies: null, config: {}},
    });
    var view = mounted.adapter.editor.view;
    await mounted.settings.ready;

    mounted.adapter.editor.setValue("  - item");
    mounted.adapter.editor.setSelection(
        require("@codemirror/state").EditorSelection.single(8, 8),
    );
    dispatchKey(view, "Enter");
    assert.strictEqual(mounted.port.readValue(), "  - item\n  - ");

    mounted.adapter.editor.setValue("  * item");
    mounted.adapter.editor.setSelection(
        require("@codemirror/state").EditorSelection.single(8, 8),
    );
    dispatchKey(view, "Enter");
    assert.strictEqual(mounted.port.readValue(), "  * item\n  * ");

    mounted.adapter.editor.setValue("  * ");
    mounted.adapter.editor.setSelection(
        require("@codemirror/state").EditorSelection.single(4, 4),
    );
    dispatchKey(view, "Enter");
    assert.strictEqual(mounted.port.readValue(), "\n");

    mounted.adapter.editor.setValue("  - ");
    mounted.adapter.editor.setSelection(
        require("@codemirror/state").EditorSelection.single(4, 4),
    );
    dispatchKey(view, " ");
    assert.strictEqual(mounted.port.readValue(), "    - ");

    mounted.adapter.editor.setValue("    - ");
    mounted.adapter.editor.setSelection(
        require("@codemirror/state").EditorSelection.single(6, 6),
    );
    dispatchKey(view, "Backspace");
    assert.strictEqual(mounted.port.readValue(), "  - ");

    mounted.adapter.editor.setSelection(
        require("@codemirror/state").EditorSelection.single(0, 0),
    );
    dispatchKey(view, "Enter", {ctrlKey: true});
    assert.strictEqual(saveCount, 1);

    mounted.adapter.editor.setValue("submit me");
    fixture.form.dispatchEvent(new fixture.window.Event("submit", {
        bubbles: true,
        cancelable: true,
    }));
    assert.strictEqual(fixture.textarea.value, "submit me");
    mounted.destroy();
    fixture.dom.window.close();
}

async function main() {
    testBridgeLifecycleAndSelection();
    await testSubmitSaveAndIndentCommands();
    console.log("CM6 DokuWiki bridge verification passed");
}

main().catch(function(error) {
    console.error(error);
    process.exitCode = 1;
});
