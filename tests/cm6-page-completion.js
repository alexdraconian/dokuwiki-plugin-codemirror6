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
var EditorSelection = require("@codemirror/state").EditorSelection;
var EditorState = require("@codemirror/state").EditorState;
var CompletionContext = require("@codemirror/autocomplete").CompletionContext;

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

var responseItems = [
    {pageid: "guide:start", title: "Guide Home"},
    {pageid: "guide:install", title: "Install Guide"},
    {pageid: "reference:api", title: "API Reference"},
];

function responseFor(items) {
    return {
        ok: true,
        status: 200,
        json: function() {
            return Promise.resolve({items: items.concat([
                {pageid: "guide:", title: "Guide namespace", kind: "namespace"},
            ])});
        },
    };
}

function sourceOptions(fetch) {
    return {
        endpoint: "/lib/exe/ajax.php",
        call: "plugin_codemirror6_page_completion",
        namespace: "guide",
        limit: 30,
        debounceMs: 0,
        fetch: fetch,
    };
}

function resultFor(source, text) {
    var state = EditorState.create({doc: text});
    return Promise.resolve(source(new CompletionContext(
        state, text.length, true,
    )));
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

function testConfigParsing(runtime) {
    var config = runtime.readDokuWikiConfig({
        plugin_codemirror: {
            pageautocomplete: "1",
            pageautocompleteEndpoint: "/lib/exe/ajax.php",
            pageautocompleteCall: "plugin_codemirror6_page_completion",
            pageautocompleteNamespace: "guide",
            pageautocompleteLimit: "31",
            pages: [
                {pageid: ":guide:start", title: "Guide Home"},
            ],
        },
    });
    assert.strictEqual(config.pageautocomplete, true);
    assert.strictEqual(config.pageautocompleteEndpoint, "/lib/exe/ajax.php");
    assert.strictEqual(config.pageautocompleteCall,
        "plugin_codemirror6_page_completion");
    assert.strictEqual(config.pageautocompleteNamespace, "guide");
    assert.strictEqual(config.pageautocompleteLimit, 31);
    assert.strictEqual("pages" in config, false);
}

async function testSource(runtime) {
    var requests = [];
    var fetch = function(url, init) {
        var params = new URLSearchParams(String(init.body));
        var query = params.get("q");
        requests.push({url: url, query: query, limit: params.get("limit")});
        if (query === "home" || query === ":guide:sta" ||
            query === "guide:sta") {
            return Promise.resolve(responseFor([responseItems[0]]));
        }
        return Promise.resolve(responseFor(responseItems));
    };
    var source = runtime.createDokuWikiPageCompletionSource(
        sourceOptions(fetch),
    );

    var byTitle = await resultFor(source, "[[home");
    assert.strictEqual(byTitle.from, 2);
    assert.strictEqual(byTitle.to, 6);
    assert.strictEqual(byTitle.options.length, 1);
    assert.strictEqual(byTitle.options[0].label, ":guide:start");
    assert.strictEqual(byTitle.options[0].detail, "Guide Home");
    assert.strictEqual(byTitle.options[0].apply, ":guide:start");

    var absolute = await resultFor(source, "[[:guide:sta");
    assert.strictEqual(absolute.options.length, 1);
    assert.strictEqual(absolute.options[0].apply, ":guide:start");

    var pluginSyntax = await resultFor(source, "{{page>guide:sta");
    assert.strictEqual(pluginSyntax.from, 7);
    assert.strictEqual(pluginSyntax.options.length, 1);
    assert.strictEqual(pluginSyntax.options[0].apply, ":guide:start");

    var anywhere = await resultFor(source, "plain text");
    assert.strictEqual(anywhere.from, 6);
    assert.strictEqual(anywhere.options.length, responseItems.length);
    assert.ok(anywhere.options.every(function(option) {
        return !option.label.endsWith(":");
    }), "page completion results contain pages only");

    var empty = await resultFor(source, "");
    assert.strictEqual(empty.options.length, responseItems.length);
    assert.strictEqual(requests[requests.length - 1].query, "guide:");
    assert.strictEqual(requests[requests.length - 1].limit, "30");
    assert.ok(requests.length >= 5,
        "opening completion did not make an asynchronous request");
}

async function testTitlelessPage(runtime) {
    var fetch = function() {
        return Promise.resolve(responseFor([
            {pageid: "guide:without-title"},
        ]));
    };
    var source = runtime.createDokuWikiPageCompletionSource(
        sourceOptions(fetch),
    );
    var result = await resultFor(source, "[[without-title");
    assert.strictEqual(result.options.length, 1);
    assert.strictEqual(result.options[0].label, ":guide:without-title");
    assert.strictEqual(result.options[0].detail, "");
    assert.strictEqual(result.options[0].apply, ":guide:without-title");
}
async function testCtrlSpaceAndApply(runtime) {
    var dom = new JSDOM("<!doctype html><div id='host'></div>", {
        pretendToBeVisual: true,
    });
    var host = dom.window.document.getElementById("host");
    var fetch = function() {
        return Promise.resolve(responseFor([responseItems[1]]));
    };
    var editor = runtime.createEditor({
        parent: host,
        doc: "{{page>install",
        extensions: runtime.createDokuWikiPageCompletion(
            sourceOptions(fetch),
        ),
    });
    editor.setSelection(EditorSelection.single(14, 14));
    dispatchKey(editor.view, " ", {ctrlKey: true});
    await new Promise(function(resolve) { dom.window.setTimeout(resolve, 100); });
    var popup = host.querySelector(".cm-tooltip-autocomplete");
    assert.ok(popup,
        "Ctrl-Space did not open page completion");
    assert.ok(popup.querySelector(".cm-dw-page-completion .cm-completionLabel"),
        "page completion option does not expose its semantic styling class");
    assert.ok(popup.querySelector(".cm-dw-page-completion .cm-completionDetail"),
        "page completion option does not expose its title detail");
    await new Promise(function(resolve) { dom.window.setTimeout(resolve, 100); });
    dispatchKey(editor.view, "Enter");
    assert.strictEqual(editor.getValue(), "{{page>:guide:install");
    editor.destroy();
    dom.window.close();
}

async function testPageConfiguration(runtime, fetchCalls) {
    var dom = new JSDOM(
        "<!doctype html><div id='size__ctl'></div><form>" +
        "<textarea id='wiki__text'>{{page>install</textarea></form>",
        {pretendToBeVisual: true},
    );
    dom.window.JSINFO = {
        plugin_codemirror: {
            pageautocomplete: "1",
            pageautocompleteEndpoint: "/lib/exe/ajax.php",
            pageautocompleteCall: "plugin_codemirror6_page_completion",
            pageautocompleteNamespace: "guide",
            pageautocompleteLimit: 30,
        },
    };
    var integration = runtime.startDokuWikiPage({
        window: dom.window,
        document: dom.window.document,
    });
    assert.ok(integration && integration.editor,
        "page integration did not mount with page completion enabled");
    assert.strictEqual(fetchCalls.length, 0,
        "page loading made a page completion request");
    var editor = integration.editor.adapter.editor;
    editor.setSelection(EditorSelection.single(14, 14));
    dispatchKey(editor.view, " ", {ctrlKey: true});
    await new Promise(function(resolve) { dom.window.setTimeout(resolve, 500); });
    assert.strictEqual(fetchCalls.length, 1,
        "opening completion did not request page data");
    assert.ok(editor.view.dom.querySelector(".cm-tooltip-autocomplete"),
        "page config did not install page completion");
    integration.destroy();
    dom.window.close();
}

var dom = new JSDOM("<!doctype html><div></div>", {pretendToBeVisual: true});
var fetchCalls = [];
dom.window.fetch = function(url, init) {
    fetchCalls.push({url: url, body: String(init.body)});
    return Promise.resolve(responseFor([responseItems[1]]));
};
global.fetch = dom.window.fetch;
var runtime = loadRuntime(dom.window);
Promise.resolve()
    .then(function() {
        testConfigParsing(runtime);
        return testSource(runtime);
    })
    .then(function() {
        return testTitlelessPage(runtime);
    })
    .then(function() {
        return testCtrlSpaceAndApply(runtime);
    })
    .then(function() {
        return testPageConfiguration(runtime, fetchCalls);
    })
    .then(function() {
        dom.window.close();
        console.log("CM6 page completion verification passed");
    })
    .catch(function(error) {
        dom.window.close();
        console.error(error);
        process.exitCode = 1;
    });
