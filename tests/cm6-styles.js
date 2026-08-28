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

function read(file) { return fs.readFileSync(file, "utf8"); }

function loadRuntime(window) {
    var sandbox = window || {console: console};
    sandbox.console = console;
    if (sandbox.requestAnimationFrame === undefined) {
        sandbox.requestAnimationFrame = function(callback) {
            return sandbox.setTimeout(callback, 0);
        };
    }
    if (sandbox.cancelAnimationFrame === undefined) {
        sandbox.cancelAnimationFrame = function(id) {
            sandbox.clearTimeout(id);
        };
    }
    var context = vm.createContext(sandbox);
    new vm.Script(read(BUNDLE), {filename: BUNDLE}).runInContext(context);
    return context.DokuWikiCodeMirror6.createCm6Runtime();
}

function extractCm5Styles() {
    var styles = new Set();
    read(path.join(ROOT, "mode.js")).split(/\r?\n/).forEach(function(line) {
        if (!/\bstyle\b/.test(line)) {
            return;
        }
        var property = line.match(/\bstyle\s*:\s*["']([a-z][a-z-]*)["']/);
        if (property) {
            styles.add(property[1]);
        }
        var assignment = line.match(/\bstyle\s*=\s*([^;]+)/);
        if (assignment) {
            var matches = assignment[1].matchAll(/["']([a-z][a-z-]*)["']/g);
            for (var match of matches) {
                styles.add(match[1]);
            }
        }
    });
    return Array.from(styles).sort();
}

function testCompleteTokenTable() {
    var runtime = loadRuntime();
    var expected = extractCm5Styles();
    var table = Object.keys(runtime.dokuWikiTokenTable).sort();
    assert.deepStrictEqual(table, expected,
        "CM5 style strings must all have a CM6 tokenTable mapping");
    assert.deepStrictEqual(Array.from(runtime.dokuWikiStyleNames).sort(), expected,
        "exported CM6 style names must match the CM5 extraction");
    assert.ok(runtime.dokuWikiTokenTable.underline,
        "underline must use an explicit CM6 tag");
    assert.ok(runtime.dokuWikiTokenTable.error,
        "error must use an explicit CM6 invalid tag");
    assert.ok(runtime.dokuWikiHighlightStyle.style([
        runtime.dokuWikiTokenTable.underline,
    ]), "underline has no highlight style");
    assert.ok(runtime.dokuWikiHighlightStyle.style([
        runtime.dokuWikiTokenTable.error,
    ]), "invalid token has no highlight style");
    assert.ok(runtime.dokuWikiHighlightStyle.style([
        runtime.dokuWikiTokenTable.def,
    ]), "definition token has no highlight style");
    assert.strictEqual(runtime.version, "phase-13-settings-and-static-highlight");
}

function testDefaultThemeDomHighlight() {
    var dom = new JSDOM(
        "<!doctype html><div id=\"host\"></div>",
        {pretendToBeVisual: true},
    );
    var runtime = loadRuntime(dom.window);
    var host = dom.window.document.getElementById("host");
    var language = runtime.createDokuWikiLanguage({
        plugins: ["exttab3"],
        validLang: function() { return false; },
    });
    var editor = runtime.createEditor({
        parent: host,
        doc: "== Heading ==\n**bold** __under__\n  * item\n^ heading ^\n| cell |\n{| table\n|- row\n|}",
        extensions: language,
    });
    var spans = host.querySelectorAll(".cm-line span");
    assert.ok(spans.length > 0,
        "default theme did not create highlighted token spans");
    assert.ok(Array.from(spans).some(function(span) {
        return span.textContent === "== Heading ==";
    }), "heading token was not rendered");
    assert.ok(Array.from(spans).some(function(span) {
        return span.textContent === "__";
    }), "underline delimiter was not rendered");
    assert.ok(Array.from(spans).some(function(span) {
        return span.textContent === "  *";
    }), "list marker was not rendered");
    assert.ok(Array.from(spans).some(function(span) {
        return span.textContent === "^";
    }), "DokuWiki table marker was not rendered");
    assert.ok(Array.from(spans).some(function(span) {
        return span.textContent === "{|";
    }), "exttab3 table marker was not rendered");
    var styleText = Array.from(dom.window.document.head.querySelectorAll("style"))
        .map(function(style) { return style.textContent; })
        .join("\n");
    assert.ok(/text-decoration[^;]*underline/.test(styleText),
        "underline CSS was not installed");
    assert.ok(/#f00/.test(styleText),
        "invalid token CSS was not installed");
    editor.destroy();
    dom.window.close();
}

testCompleteTokenTable();
testDefaultThemeDomHighlight();
console.log("CM6 token mapping and default theme verification passed");
