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
var pathToFileURL = require("url").pathToFileURL;
var vm = require("vm");
var JSDOM = require("jsdom").JSDOM;
var legacyJavascript = require("@codemirror/legacy-modes/mode/javascript").javascript;
var legacyStexMath = require("@codemirror/legacy-modes/mode/stex").stexMath;

var ROOT = path.resolve(__dirname, "..");
var BUNDLE = path.join(ROOT, "dist", "cm6", "scripts.min.js");
var LANGUAGES = path.join(ROOT, "dist", "cm6", "languages");

function read(file) { return fs.readFileSync(file, "utf8"); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }

function loadRuntime(window) {
    var sandbox = window || {console: console};
    sandbox.console = console;
    vm.createContext(sandbox);
    new vm.Script(read(BUNDLE), {filename: BUNDLE}).runInContext(sandbox);
    return sandbox.DokuWikiCodeMirror6.createCm6Runtime();
}

function baselineKeys() {
    var source = read(path.join(ROOT, "init.js"));
    var start = source.indexOf("var codeModes = {");
    var end = source.indexOf("\n    };", start);
    var keys = [];
    var pattern = /^\s{8}(?:(['"])(.*?)\1|([A-Za-z0-9_.-]+)):\s*\{/gm;
    var match;
    while ((match = pattern.exec(source.slice(start, end))) !== null) {
        keys.push(match[2] || match[3]);
    }
    return keys;
}

function fakeLegacyMode() {
    return {
        startState: function() { return {}; },
        token: function(stream) { stream.next(); return "keyword"; },
    };
}

async function testMetadata(runtime) {
    var registry = runtime.embeddedLanguageRegistry;
    var keys = baselineKeys();
    assert.strictEqual(keys.length, 159, "CM5 baseline must contain 159 keys");
    assert.strictEqual(registry.keys.length, 159, "CM6 registry must contain 159 keys");
    assert.strictEqual(new Set(registry.keys).size, 159, "CM6 registry keys must be unique");
    assert.deepStrictEqual(Array.from(registry.keys), keys,
        "CM6 registry key set/order differs from init.js");

    assert.deepStrictEqual(plain(registry.lookup("javascript")), {
        key: "javascript", name: "javascript", mime: "application/javascript",
        deps: [], provider: "legacy", providerKey: "javascript",
        asset: "legacy.js",
    });
    assert.deepStrictEqual(plain(registry.lookup("php")), {
        key: "php", name: "php", mime: "application/x-httpd-php-open",
        deps: ["htmlmixed"], provider: "native", providerKey: "php",
        asset: "php.js",
    });
    assert.deepStrictEqual(plain(registry.lookup("smarty")), {
        key: "smarty", name: "smarty", deps: [],
        options: {version: 2}, provider: "fallback",
    });
    assert.deepStrictEqual(plain(registry.lookup("aspx").deps), ["clike"]);
    assert.strictEqual(registry.lookup("unknown"), null);
    assert.strictEqual(registry.has("js"), false,
        "unlisted aliases must retain exact-match behavior");
}

async function testFallbackRetryAndCache(runtime) {
    var calls = [];
    var registry = runtime.createEmbeddedLanguageRegistry({
        assetBaseUrl: "/lib/plugins/codemirror6/dist/cm6/languages",
        maxRetries: 1,
        importModule: async function(asset, spec) {
            calls.push({asset: asset, key: spec.key});
            return spec.provider === "native" ? {
                getLanguageSupport: function() { return {extension: []}; },
            } : {
                getLegacyMode: function() { return fakeLegacyMode(); },
            };
        },
    });

    var javascript = await registry.load("javascript");
    assert.strictEqual(javascript.status, "loaded");
    assert.ok(javascript.mode, "legacy language did not resolve a mode");
    await registry.load("javascript");
    assert.strictEqual(calls.length, 1, "same asset was imported more than once");
    assert.strictEqual(registry.getStatus("javascript").status, "loaded");

    var php = await registry.load("php");
    assert.strictEqual(php.status, "loaded");
    assert.ok(php.support, "native language did not resolve LanguageSupport");
    assert.strictEqual(calls[1].asset,
        "/lib/plugins/codemirror6/dist/cm6/languages/php.js");

    var fallback = await registry.load("text");
    assert.strictEqual(fallback.status, "fallback");
    assert.strictEqual(fallback.attempts, 0);
    var unknown = await registry.load("unknown");
    assert.strictEqual(unknown.status, "unknown");
    assert.strictEqual(calls.length, 2,
        "fallback and unknown languages must not load arbitrary assets");

    var flakyCalls = 0;
    var flaky = runtime.createEmbeddedLanguageRegistry({
        maxRetries: 1,
        importModule: async function() {
            flakyCalls += 1;
            if (flakyCalls === 1) {
                throw new Error("transient failure");
            }
            return {getLegacyMode: function() { return fakeLegacyMode(); }};
        },
    });
    var recovered = await flaky.load("python");
    assert.strictEqual(recovered.status, "loaded");
    assert.strictEqual(recovered.attempts, 2,
        "loader should retry once after a transient failure");
    assert.strictEqual(flakyCalls, 2);

    var failedCalls = 0;
    var failed = runtime.createEmbeddedLanguageRegistry({
        maxRetries: 1,
        importModule: async function() {
            failedCalls += 1;
            throw new Error("permanent failure");
        },
    });
    var failure = await failed.load("ruby");
    assert.strictEqual(failure.status, "failed");
    assert.strictEqual(failure.attempts, 2);
    assert.strictEqual(failed.getLegacyMode("ruby"), null);
    assert.strictEqual(failed.getStatus("ruby").status, "failed");
    assert.strictEqual(failedCalls, 2);
}

async function testRealChunks(runtime) {
    var registry = runtime.createEmbeddedLanguageRegistry({
        assetBaseUrl: LANGUAGES,
        importModule: function(asset) {
            return import(pathToFileURL(asset).href);
        },
    });
    var javascript = await registry.load("javascript");
    var python = await registry.load("python");
    var php = await registry.load("php");
    var yaml = await registry.load("yaml");
    assert.strictEqual(javascript.status, "loaded");
    assert.strictEqual(python.status, "loaded");
    assert.strictEqual(php.status, "loaded");
    assert.strictEqual(yaml.status, "loaded");
    assert.ok(javascript.mode && python.mode && yaml.mode);
    assert.ok(php.highlighter);
    var legacyAliases = registry.keys.filter(function(alias) {
        return registry.lookup(alias).provider === "legacy";
    });
    for (var legacyIndex = 0; legacyIndex < legacyAliases.length; legacyIndex += 1) {
        var legacyAlias = legacyAliases[legacyIndex];
        var legacy = await registry.load(legacyAlias);
        assert.strictEqual(legacy.status, "loaded",
            "legacy provider did not load for " + legacyAlias);
        assert.ok(legacy.mode,
            "legacy provider did not expose a mode for " + legacyAlias);
    }
    assert.strictEqual(path.basename(registry.assetUrl("javascript")), "legacy.js");
    assert.strictEqual(path.basename(registry.assetUrl("php")), "php.js");

    var source = "<code javascript demo.js>const answer = 42;</code>\n" +
        "<file php>echo $answer;</file>\n<code unknown>plain</code>";
    var blocks = runtime.scanEmbeddedCodeBlocks(source);
    assert.strictEqual(blocks.length, 3);
    assert.strictEqual(blocks[0].filename, "demo.js");
    assert.strictEqual(blocks[1].kind, "file");
    assert.strictEqual(blocks[2].closed, true);
    var highlighted = await runtime.highlightEmbeddedDocument(source, registry);
    assert.ok(highlighted[0].spans.length > 0,
        "loaded legacy provider did not produce embedded spans");
    assert.ok(highlighted[1].spans.length > 0,
        "loaded native provider did not produce embedded spans");
    assert.strictEqual(highlighted[2].spans.length, 0,
        "unknown language must remain plain");
    assert.ok(highlighted[0].spans.every(function(span) {
        return span.from >= blocks[0].from && span.to <= blocks[0].to;
    }), "legacy spans escaped the code body boundary");
}

async function testHtmlMixedProvider() {
    var dom = new JSDOM("<!doctype html><div id=editor></div>" +
        "<div id=dokuwiki__content><pre class=\"code html\"></pre></div>", {
        pretendToBeVisual: true,
    });
    var runtime = loadRuntime(dom.window);
    var registry = runtime.createEmbeddedLanguageRegistry({
        assetBaseUrl: LANGUAGES,
        importModule: function(asset) {
            return import(pathToFileURL(asset).href);
        },
    });
    var html = await registry.load("html");
    assert.strictEqual(html.status, "loaded");
    assert.ok(html.mode, "HTML provider did not resolve a mixed mode");

    var source = "<div class=\"app\">ok</div>\n" +
        "<style>body { color: red; }</style>\n" +
        "<script>const answer = 42;</script>";
    var block = {
        closed: true,
        filename: null,
        from: 0,
        kind: "code",
        lang: "html",
        to: source.length,
    };
    var highlighted = await runtime.highlightEmbeddedBlock(source, block, registry);
    function hasToken(text, className) {
        return highlighted.spans.some(function(span) {
            return source.slice(span.from, span.to) === text &&
                span.classes.indexOf(className) !== -1;
        });
    }
    assert.ok(hasToken("div", "tok-typeName"),
        "HTML tag was not highlighted by the mixed provider");
    assert.ok(hasToken("color", "tok-propertyName"),
        "CSS inside HTML was not highlighted by the mixed provider");
    assert.ok(hasToken("const", "tok-keyword"),
        "JavaScript inside HTML was not highlighted by the mixed provider");

    var pre = dom.window.document.querySelector("pre.code.html");
    pre.textContent = source;
    var staticResult = await runtime.highlightStaticCodeBlocks(dom.window.document, registry);
    assert.strictEqual(staticResult.highlighted, 1,
        "static HTML code block was not highlighted");
    assert.ok(Array.from(pre.querySelectorAll("span")).some(function(span) {
        return span.textContent === "const";
    }), "static HTML block did not render JavaScript token spans");

    var callbacks = registry.parserCallbacks();
    var controller = runtime.createEditor({
        parent: dom.window.document.getElementById("editor"),
        doc: "<html>\n" + source + "\n</html>",
        extensions: runtime.createDokuWikiLanguage({
            loadEmbeddedMode: callbacks.loadEmbeddedMode,
            validLang: callbacks.validLang,
        }),
    });
    var editorSpans = Array.from(controller.view.dom.querySelectorAll(".cm-line span"));
    assert.ok(editorSpans.some(function(span) { return span.textContent === "red"; }),
        "CSS inside the DokuWiki HTML plugin was not highlighted");
    assert.ok(editorSpans.some(function(span) { return span.textContent === "const"; }),
        "JavaScript inside the DokuWiki HTML plugin was not highlighted");
    controller.destroy();
    dom.window.close();
}

async function testEditorRehighlight() {
    var dom = new JSDOM("<!doctype html><div id=editor></div>", {
        pretendToBeVisual: true,
    });
    var runtime = loadRuntime(dom.window);
    var resolveImport;
    var registry = runtime.createEmbeddedLanguageRegistry({
        importModule: function() {
            return new Promise(function(resolve) { resolveImport = resolve; });
        },
    });
    var host = dom.window.document.getElementById("editor");
    var controller = runtime.createEditor({
        parent: host,
        doc: "<code javascript>const value = 1;</code>",
        extensions: runtime.createEmbeddedLanguageHighlighting(registry),
    });
    await new Promise(function(resolve) { setTimeout(resolve, 0); });
    assert.strictEqual(host.querySelectorAll(".cm-line span").length, 0,
        "pending language should not render stale spans");
    resolveImport({getLegacyMode: function() { return legacyJavascript; }});
    await new Promise(function(resolve) { setTimeout(resolve, 30); });
    assert.ok(host.querySelectorAll(".cm-line span").length > 0,
        "language load did not trigger editor rehighlight");
    controller.destroy();
    dom.window.close();
}

async function testDokuWikiInitialEmbeddedHighlighting() {
    var dom = new JSDOM("<!doctype html><div id=editor></div>", {
        pretendToBeVisual: true,
    });
    var runtime = loadRuntime(dom.window);
    var resolveImport;
    var registry = runtime.createEmbeddedLanguageRegistry({
        importModule: function() {
            return new Promise(function(resolve) { resolveImport = resolve; });
        },
    });
    var callbacks = registry.parserCallbacks();
    var host = dom.window.document.getElementById("editor");
    var controller = runtime.createEditor({
        parent: host,
        doc: "<code javascript>const value = 1;</code>",
        extensions: [
            runtime.createDokuWikiLanguage({
                loadEmbeddedMode: callbacks.loadEmbeddedMode,
                validLang: callbacks.validLang,
            }),
            runtime.createEmbeddedLanguageHighlighting(registry),
        ],
    });
    await new Promise(function(resolve) { setTimeout(resolve, 0); });
    var before = host.querySelectorAll(".cm-line span").length;
    resolveImport({getLegacyMode: function() { return legacyJavascript; }});
    await new Promise(function(resolve) { setTimeout(resolve, 30); });
    var after = host.querySelectorAll(".cm-line span").length;
    assert.ok(after > before,
        "DokuWiki page did not rehighlight an embedded language without typing");
    controller.destroy();
    dom.window.close();
}

async function testDokuWikiInitialMathHighlighting() {
    var dom = new JSDOM("<!doctype html><div id=editor></div>", {
        pretendToBeVisual: true,
    });
    var runtime = loadRuntime(dom.window);
    var resolveImport;
    var registry = runtime.createEmbeddedLanguageRegistry({
        importModule: function() {
            return new Promise(function(resolve) { resolveImport = resolve; });
        },
    });
    var callbacks = registry.parserCallbacks();
    var parserConfig = {
        loadEmbeddedMode: callbacks.loadEmbeddedMode,
        plugins: ["mathjax"],
        validLang: callbacks.validLang,
    };
    var host = dom.window.document.getElementById("editor");
    var controller;
    var embeddedHighlighting;
    var refreshParser = function() {
        controller.reconfigure(controller.compartments.language, [
            runtime.createDokuWikiLanguage(parserConfig),
            embeddedHighlighting,
        ]);
    };
    embeddedHighlighting = runtime.createEmbeddedLanguageHighlighting(
        registry,
        refreshParser,
    );
    controller = runtime.createEditor({
        parent: host,
        doc: "<MATH>\\langle 1, 2, 3, 4, 5, ...\\rangle</MATH>",
        extensions: [
            runtime.createDokuWikiLanguage(parserConfig),
            embeddedHighlighting,
        ],
    });
    await new Promise(function(resolve) { setTimeout(resolve, 0); });
    var before = host.querySelectorAll(".cm-line span").length;
    resolveImport({getLegacyMode: function() { return legacyStexMath; }});
    await new Promise(function(resolve) { setTimeout(resolve, 30); });
    var after = host.querySelectorAll(".cm-line span").length;
    assert.strictEqual(before, 2,
        "pending TeX mode should render only the two DokuWiki tags");
    assert.ok(after > before,
        "mathjax did not rehighlight without typing the first character");
    var highlightedNumbers = ["1", "2", "3", "4", "5"].filter(function(number) {
        return Array.from(host.querySelectorAll(".cm-line span")).some(function(span) {
            return span.textContent === number;
        });
    });
    assert.deepStrictEqual(highlightedNumbers, ["1", "2", "3", "4", "5"],
        "mathjax must use the TeX math mode for every numeric token");
    controller.destroy();
    dom.window.close();
}

async function testEditorRefreshCoalescingAndCache() {
    var dom = new JSDOM("<!doctype html><div id=editor></div>", {
        pretendToBeVisual: true,
    });
    var runtime = loadRuntime(dom.window);
    var calls = [];
    var registry = runtime.createEmbeddedLanguageRegistry({
        importModule: function() {
            return Promise.resolve({
                getHighlighter: function() {
                    return function(source) {
                        calls.push(source);
                        return source.length ? [{
                            classes: "tok-test",
                            from: 0,
                            to: source.length,
                        }] : [];
                    };
                },
            });
        },
    });
    var host = dom.window.document.getElementById("editor");
    var first = "const first = 1;";
    var second = "const second = 2;";
    var controller = runtime.createEditor({
        parent: host,
        doc: "<code php>" + first + "</code>\n" +
            "ordinary text\n" +
            "<code php>" + second + "</code>",
        extensions: runtime.createEmbeddedLanguageHighlighting(registry),
    });

    await new Promise(function(resolve) { setTimeout(resolve, 30); });
    assert.deepStrictEqual(calls, [first, second],
        "initial embedded blocks were not highlighted exactly once");

    controller.setValue("prefix\n" + controller.getValue());
    await new Promise(function(resolve) { setTimeout(resolve, 30); });
    assert.deepStrictEqual(calls, [first, second],
        "debounce did not defer a pending refresh");
    await new Promise(function(resolve) { setTimeout(resolve, 110); });
    assert.deepStrictEqual(calls, [first, second],
        "moving unchanged blocks reran their providers");

    var changed = controller.getValue().replace(first, "const first = 10;");
    controller.setValue(changed);
    await new Promise(function(resolve) { setTimeout(resolve, 110); });
    assert.deepStrictEqual(calls, [first, second, "const first = 10;"],
        "editing one block reran an unrelated embedded provider");

    controller.destroy();
    dom.window.close();
}

async function main() {
    var runtime = loadRuntime();
    await testMetadata(runtime);
    await testFallbackRetryAndCache(runtime);
    await testRealChunks(runtime);
    await testHtmlMixedProvider();
    await testEditorRehighlight();
    await testDokuWikiInitialEmbeddedHighlighting();
    await testDokuWikiInitialMathHighlighting();
    await testEditorRefreshCoalescingAndCache();
    console.log("CM6 embedded language registry passed: 159 metadata entries, " +
        "exact aliases, optional chunks, fallback/retry/cache, boundaries, initial rehighlight, " +
        "and coalesced editor refresh.");
}

main().catch(function(error) {
    console.error(error.stack || error);
    process.exitCode = 1;
});
