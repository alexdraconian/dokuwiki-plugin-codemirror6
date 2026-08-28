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
    return event;
}

async function testDocumentWideSearch() {
    var dom = new JSDOM(
        "<!doctype html><div id=\"host\"></div>",
        {pretendToBeVisual: true},
    );
    var runtime = loadRuntime(dom.window);
    var host = dom.window.document.getElementById("host");
    var lines = [];
    for (var index = 0; index < 240; index += 1) {
        lines.push("line " + index + " has ordinary content");
    }
    lines[150] = "offscreen first needle target";
    lines[210] = "offscreen second needle target";
    var documentText = lines.join("\n");
    var editor = runtime.createEditor({
        parent: host,
        doc: documentText,
    });
    var settings = runtime.createEditorSettings(editor);
    await settings.ready;

    var openEvent = dispatchKey(editor.view, "f", {ctrlKey: true});
    assert.strictEqual(openEvent.defaultPrevented, true,
        "Ctrl+F was not captured by CodeMirror");
    var panel = host.querySelector(".cm-search");
    assert.ok(panel, "CodeMirror search panel did not open");

    var input = panel.querySelector("input[name=search]");
    assert.ok(input, "CodeMirror search input is missing");
    input.value = "needle";
    input.dispatchEvent(new dom.window.Event("keyup", {bubbles: true}));

    var firstNextEvent = dispatchKey(editor.view, "F3");
    assert.strictEqual(firstNextEvent.defaultPrevented, true,
        "F3 was not captured by CodeMirror");
    assert.strictEqual(editor.view.state.selection.main.from,
        documentText.indexOf("needle"),
        "search did not find the first match in the full document");

    dispatchKey(editor.view, "F3");
    assert.strictEqual(editor.view.state.selection.main.from,
        documentText.lastIndexOf("needle"),
        "search did not advance to the next full-document match");

    settings.dispose();
    editor.destroy();
    dom.window.close();
}

testDocumentWideSearch()
    .then(function() {
        console.log("CM6 document-wide search verification passed");
    })
    .catch(function(error) {
        console.error(error);
        process.exitCode = 1;
    });
