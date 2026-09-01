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

function assertSelection(selection, expected) {
    assert.strictEqual(JSON.stringify(selection.ranges.map(function(range) {
        return [range.anchor, range.head];
    })), JSON.stringify(expected));
}

function createFixture() {
    var dom = new JSDOM(
        "<!doctype html><form id=\"edit\">" +
        "<textarea id=\"wiki__text\" style=\"height: 200px\" wrap=\"off\">" +
        "한😀글\\n두 번째 줄</textarea></form>",
        {pretendToBeVisual: true},
    );
    var runtime = loadRuntime(dom.window);
    var form = dom.window.document.getElementById("edit");
    var textarea = dom.window.document.getElementById("wiki__text");
    return {dom: dom, form: form, textarea: textarea, runtime: runtime};
}

function testMountInputSubmitDestroyRecreate() {
    var fixture = createFixture();
    var textarea = fixture.textarea;
    var form = fixture.form;
    var runtime = fixture.runtime;
    var addSubmitListeners = 0;
    var removeSubmitListeners = 0;
    var addEventListener = form.addEventListener.bind(form);
    var removeEventListener = form.removeEventListener.bind(form);
    form.addEventListener = function(type, listener, capture) {
        if (type === "submit") {
            addSubmitListeners += 1;
        }
        return addEventListener(type, listener, capture);
    };
    form.removeEventListener = function(type, listener, capture) {
        if (type === "submit") {
            removeSubmitListeners += 1;
        }
        return removeEventListener(type, listener, capture);
    };

    textarea.focus();
    textarea.setSelectionRange(1, 3, "forward");
    var adapter = runtime.mountTextArea({textarea: textarea});
    assert.strictEqual(textarea.style.display, "none");
    assert.strictEqual(adapter.host.parentNode, form);
    assert.ok(adapter.host.classList.contains("tex2jax_ignore"));
    assert.ok(adapter.host.querySelector(".cm-editor"));
    assert.strictEqual(adapter.host.style.height, "200px");
    assert.strictEqual(adapter.editor.view.state.doc.toString(), textarea.value);
    assert.strictEqual(adapter.editor.view.state.tabSize, 2);
    assert.strictEqual(adapter.editor.view.lineWrapping, false);
    assert.strictEqual(adapter.host.querySelectorAll(".cm-line span").length, 0);
    assert.strictEqual(addSubmitListeners, 1);
    assert.strictEqual(runtime.mountTextArea({textarea: textarea}), adapter);
    assert.strictEqual(addSubmitListeners, 1);

    adapter.editor.view.dispatch({
        changes: {from: 0, to: 1, insert: "새"},
    });
    assert.notStrictEqual(textarea.value, adapter.getValue());
    form.dispatchEvent(new fixture.dom.window.Event("submit", {
        bubbles: true,
        cancelable: true,
    }));
    assert.strictEqual(textarea.value, adapter.getValue());
    assert.strictEqual(textarea.value.slice(0, 3), "새😀");

    adapter.editor.setLineWrapping(true);
    assert.strictEqual(adapter.editor.view.state.doc.toString(), textarea.value);
    assert.ok(adapter.editor.view.dom.querySelector(".cm-lineWrapping"));

    adapter.editor.view.focus();
    adapter.editor.setSelection(
        adapter.editor.view.state.selection.constructor.create([
            adapter.editor.view.state.selection.constructor.range(1, 1),
            adapter.editor.view.state.selection.constructor.range(4, 6),
        ], 1),
    );
    assertSelection(adapter.getSelection(), [[1, 1], [4, 6]]);

    adapter.destroy();
    adapter.destroy();
    assert.strictEqual(removeSubmitListeners, 1);
    assert.strictEqual(adapter.host.parentNode, null);
    assert.strictEqual(textarea.style.display, "");
    assert.strictEqual(textarea.value, "새😀글\\n두 번째 줄");
    assert.strictEqual(textarea.selectionStart, 4);
    assert.strictEqual(textarea.selectionEnd, 6);
    assert.strictEqual(fixture.dom.window.document.activeElement, textarea);
    assert.strictEqual(runtime.getMountedTextAreaAdapter(textarea), undefined);

    var recreated = runtime.mountTextArea({textarea: textarea});
    assert.notStrictEqual(recreated, adapter);
    assert.strictEqual(recreated.getValue(), textarea.value);
    recreated.destroy();
    fixture.dom.window.close();
}

function testReadOnlyAndUtf16Selection() {
    var fixture = createFixture();
    var textarea = fixture.textarea;
    textarea.readOnly = true;
    textarea.setSelectionRange(1, 3, "backward");
    var adapter = fixture.runtime.mountTextArea({
        textarea: textarea,
        tabSize: 2,
        autoHeight: true,
    });

    assert.strictEqual(adapter.editor.view.state.readOnly, true);
    assert.strictEqual(adapter.editor.view.state.tabSize, 2);
    assert.strictEqual(adapter.host.style.height, "auto");
    assertSelection(adapter.getSelection(), [[1, 3]]);
    assert.notStrictEqual(adapter.editor.view.contentDOM.getAttribute("contenteditable"), "true");

    adapter.setValue("한😀");
    adapter.setSelection(
        adapter.editor.view.state.selection.constructor.single(1, 3),
    );
    assertSelection(adapter.getSelection(), [[1, 3]]);
    adapter.destroy();
    assert.strictEqual(textarea.selectionStart, 1);
    assert.strictEqual(textarea.selectionEnd, 3);
    fixture.dom.window.close();
}

function testHistory() {
    var fixture = createFixture();
    var adapter = fixture.runtime.mountTextArea({textarea: fixture.textarea});

    adapter.editor.setValue("one");
    adapter.editor.view.dispatch({
        changes: {from: 3, insert: "!"},
        userEvent: "input",
    });
    assert.strictEqual(adapter.getValue(), "one!");
    assert.strictEqual(undo(adapter.editor.view), true);
    assert.strictEqual(adapter.getValue(), "one");
    assert.strictEqual(redo(adapter.editor.view), true);
    assert.strictEqual(adapter.getValue(), "one!");

    adapter.destroy();
    fixture.dom.window.close();
}
testMountInputSubmitDestroyRecreate();
testReadOnlyAndUtf16Selection();
console.log("CM6 editor lifecycle verification passed");
