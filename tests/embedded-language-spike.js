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
var esbuild = require("esbuild");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var EditorState = require("@codemirror/state").EditorState;
var cmLanguage = require("@codemirror/language");
var highlight = require("@lezer/highlight");
var StringStream = cmLanguage.StringStream;
var StreamLanguage = cmLanguage.StreamLanguage;
var ensureSyntaxTree = cmLanguage.ensureSyntaxTree;
var syntaxTree = cmLanguage.syntaxTree;
var highlightTree = highlight.highlightTree;
var classHighlighter = highlight.classHighlighter;

var ROOT = path.resolve(__dirname, "..");
var BUNDLE = path.join(ROOT, "dist", "cm6", "scripts.min.js");
var legacyJavascript = require("@codemirror/legacy-modes/mode/javascript");
var legacyPython = require("@codemirror/legacy-modes/mode/python");
var legacyXml = require("@codemirror/legacy-modes/mode/xml");
var legacyCss = require("@codemirror/legacy-modes/mode/css");
var legacySql = require("@codemirror/legacy-modes/mode/sql");
var nativeJavascript = require("@codemirror/lang-javascript");
var nativePython = require("@codemirror/lang-python");
var nativePhp = require("@codemirror/lang-php");
var nativeXml = require("@codemirror/lang-xml");
var nativeCss = require("@codemirror/lang-css");
var nativeSql = require("@codemirror/lang-sql");

function read(file) { return fs.readFileSync(file, "utf8"); }
function loadRuntime() {
    var sandbox = {console: console};
    vm.createContext(sandbox);
    new vm.Script(read(BUNDLE), {filename: BUNDLE}).runInContext(sandbox);
    return sandbox.DokuWikiCodeMirror6.createCm6Runtime();
}
function canonicalLanguage(alias) {
    var aliases = {
        css: "css", ecmascript: "javascript", html: "xml", javascript: "javascript",
        js: "javascript", json: "javascript", jsonld: "javascript", less: "css",
        mariadb: "sql", mssql: "sql", mysql: "sql", php: "php", pgsql: "sql",
        plsql: "sql", postgresql: "sql", py: "python", python: "python", scss: "css",
        sql: "sql", typescript: "javascript", xml: "xml",
    };
    return aliases[alias] || null;
}
function legacyModeFor(alias) {
    switch (canonicalLanguage(alias)) {
    case "javascript": return legacyJavascript.javascript;
    case "python": return legacyPython.python;
    case "xml": return legacyXml.xml;
    case "css": return legacyCss.css;
    case "sql": return legacySql.standardSQL;
    default: return null;
    }
}
function plainMode() {
    return {startState: function() { return {}; }, token: function(stream) {
        stream.next(); return null;
    }};
}
function tokenizeStream(parser, source) {
    var tokens = [];
    var lines = source.split("\n");
    var state = parser.startState ? parser.startState(4) : {};
    var offset = 0;
    lines.forEach(function(line, lineIndex) {
        var stream = new StringStream(line, 4, 4);
        while (!stream.eol()) {
            var from = stream.pos;
            var attempts = 0;
            var style;
            stream.start = stream.pos;
            do { style = parser.token(stream, state); attempts += 1; }
            while (stream.pos === from && attempts < 10);
            if (stream.pos === from) throw new Error("embedded parser did not advance at line " +
                (lineIndex + 1) + ", column " + (from + 1));
            tokens.push({from: offset + from, to: offset + stream.pos,
                text: line.slice(from, stream.pos), styles: style || null});
        }
        if (line.length === 0 && parser.blankLine) parser.blankLine(state, 4);
        offset += line.length + (lineIndex < lines.length - 1 ? 1 : 0);
    });
    return tokens;
}
function scanCodeBlocks(source) {
    var blocks = [];
    var opener = /<(code|file)(?=\s|>)([^>]*)>/g;
    var match;
    while ((match = opener.exec(source))) {
        var kind = match[1];
        var params = match[2].trim().split(/\s+/).filter(Boolean);
        var closeTag = "</" + kind + ">";
        var from = match.index + match[0].length;
        var close = source.indexOf(closeTag, from);
        blocks.push({closed: close !== -1, filename: params[1] || null, from: from,
            kind: kind, lang: params[0] || "text", to: close === -1 ? source.length : close});
        opener.lastIndex = close === -1 ? source.length : close + closeTag.length;
    }
    return blocks;
}
function nativeSupportFor(alias) {
    switch (canonicalLanguage(alias)) {
    case "javascript": return nativeJavascript.javascript();
    case "python": return nativePython.python();
    case "php": return nativePhp.php({plain: true});
    case "xml": return nativeXml.xml();
    case "css": return nativeCss.css();
    case "sql": return nativeSql.sql({dialect: nativeSql.StandardSQL});
    default: return null;
    }
}
function nativeHighlight(source, support) {
    var state = EditorState.create({doc: source, extensions: [support.extension]});
    var tree = ensureSyntaxTree(state, source.length, 5000) || syntaxTree(state);
    var spans = [];
    highlightTree(tree, classHighlighter, function(from, to, classes) {
        spans.push({classes: classes, from: from, to: to});
    });
    return {spans: spans, tree: tree};
}
function nativeNodeNames(tree) {
    var names = new Set();
    tree.iterate({enter: function(node) { names.add(node.name); }});
    return names;
}
async function asyncNativeSupportFor(alias) {
    switch (canonicalLanguage(alias)) {
    case "javascript": return (await import("@codemirror/lang-javascript")).javascript();
    case "python": return (await import("@codemirror/lang-python")).python();
    case "php": return (await import("@codemirror/lang-php")).php({plain: true});
    case "xml": return (await import("@codemirror/lang-xml")).xml();
    case "css": return (await import("@codemirror/lang-css")).css();
    case "sql": {
        var sql = await import("@codemirror/lang-sql");
        return sql.sql({dialect: sql.StandardSQL});
    }
    default: return null;
    }
}
async function asyncNativeHighlight(source, support) {
    var stateModule = await import("@codemirror/state");
    var languageModule = await import("@codemirror/language");
    var highlightModule = await import("@lezer/highlight");
    var state = stateModule.EditorState.create({doc: source, extensions: [support.extension]});
    var tree = languageModule.ensureSyntaxTree(state, source.length, 5000) || languageModule.syntaxTree(state);
    var spans = [];
    highlightModule.highlightTree(tree, highlightModule.classHighlighter, function(from, to, classes) {
        spans.push({classes: classes, from: from, to: to});
    });
    return spans;
}
async function rehighlightBlock(source, block) {
    var support = await asyncNativeSupportFor(block.lang);
    if (!support) return {status: "plain", spans: []};
    return {status: "highlighted", spans: await asyncNativeHighlight(source.slice(block.from, block.to), support)};
}
async function bundleBytes(source, sourcefile) {
    var result = await esbuild.build({bundle: true, format: "iife", logLevel: "silent",
        minify: true, platform: "browser", stdin: {contents: source, loader: "js",
            resolveDir: ROOT, sourcefile: sourcefile}, write: false});
    return result.outputFiles.reduce(function(total, file) { return total + file.contents.length; }, 0);
}
function testLegacyStreamAdapter() {
    var samples = {
        css: "body { color: #333; }", javascript: "const answer = 42;\nconsole.log(answer);",
        python: "def greet(name):\n    return f\"Hello {name}\"",
        sql: "SELECT id, name FROM users WHERE id = 1;",
        xml: "<root><item id=\"1\">value</item></root>",
    };
    Object.keys(samples).forEach(function(lang) {
        var tokens = tokenizeStream(legacyModeFor(lang), samples[lang]);
        assert.ok(tokens.length > 0, lang + " legacy mode emitted no tokens");
        assert.ok(tokens.some(function(token) { return token.styles; }), lang + " legacy mode emitted no styled tokens");
    });
    assert.strictEqual(legacyModeFor("php"), null, "legacy-modes unexpectedly provided PHP");
}
function testDokuWikiBoundary(runtime) {
    var source = ["before", "<code javascript demo.js>", "const answer = 42;", "</code>",
        "after **markup**", "<file python>", "return_value = 1", "</file>", "tail"].join("\n");
    var parser = runtime.createDokuWikiParser({
        loadEmbeddedMode: function(lang) { return legacyModeFor(lang) || plainMode(); },
        validLang: function(lang) { return canonicalLanguage(lang) !== null; },
    });
    var tokens = tokenizeStream(parser, source);
    ["</code>", "</file>"].forEach(function(closeTag) {
        var close = tokens.find(function(token) { return token.text === closeTag; });
        assert.ok(close, closeTag + " boundary was not recognized");
        assert.strictEqual(close.styles, "tag", closeTag + " style changed");
        assert.ok(tokens.some(function(token) { return token.from >= close.to && token.styles === null; }),
            closeTag + " did not resume outer parsing");
    });
}
function testNativeSixLanguagePrototype() {
    var samples = {
        css: "body { color: #333; }", javascript: "const answer = 42;\nconsole.log(answer);",
        php: "$value = 42;\necho $value;", python: "def greet(name):\n    return f\"Hello {name}\"",
        sql: "SELECT id, name FROM users WHERE id = 1;", xml: "<root><item id=\"1\">value</item></root>",
    };
    Object.keys(samples).forEach(function(lang) {
        var result = nativeHighlight(samples[lang], nativeSupportFor(lang));
        assert.strictEqual(result.tree.length, samples[lang].length, lang + " native parser did not cover sample");
        assert.ok(nativeNodeNames(result.tree).size > 1, lang + " native parser produced no syntax structure");
        assert.ok(result.spans.length > 0, lang + " native highlighter emitted no spans");
    });
}
function testStreamLanguageNesting(runtime) {
    var outer = runtime.createDokuWikiLanguage({validLang: function(lang) {
        return canonicalLanguage(lang) !== null;
    }});
    assert.strictEqual(outer.allowsNesting, false, "DokuWiki StreamLanguage unexpectedly nests");
    assert.strictEqual(StreamLanguage.define(legacyJavascript.javascript).allowsNesting, false,
        "legacy StreamLanguage unexpectedly nests");
}
function testBlockScannerAndFallback() {
    var source = ["<code js demo.js>const value = 1;</code>",
        "<file unknown>plain &lt;code&gt;</file>", "<code python>", "answer = 42"].join("\n");
    var blocks = scanCodeBlocks(source);
    assert.strictEqual(blocks.length, 3, "code/file scanner lost a block");
    assert.strictEqual(blocks[0].lang, "js");
    assert.strictEqual(blocks[0].filename, "demo.js");
    assert.strictEqual(blocks[0].closed, true);
    assert.strictEqual(blocks[1].closed, true);
    assert.strictEqual(blocks[1].to - blocks[1].from, "plain &lt;code&gt;".length);
    assert.strictEqual(blocks[2].closed, false);
    assert.strictEqual(blocks[2].to, source.length);
    assert.strictEqual(canonicalLanguage("unknown"), null, "unknown language did not fallback");
}
async function testAsyncReload() {
    var source = "<code js>const answer = 42;</code>";
    var block = scanCodeBlocks(source)[0];
    var before = {status: "pending", spans: []};
    assert.strictEqual(before.spans.length, 0, "pending block should start unhighlighted");
    var after = await rehighlightBlock(source, block);
    assert.strictEqual(after.status, "highlighted");
    assert.ok(after.spans.length > 0, "async load did not produce rehighlight result");
    var unknownSource = "<code unknown>plain</code>";
    var unknown = await rehighlightBlock(unknownSource, scanCodeBlocks(unknownSource)[0]);
    assert.deepStrictEqual(unknown, {status: "plain", spans: []}, "unknown did not stay plain");
}
async function testLargeBlockAndBundleSize() {
    var largeSource = "const value = 1;\n".repeat(10000);
    var result = nativeHighlight(largeSource, nativeSupportFor("javascript"));
    assert.strictEqual(result.tree.length, largeSource.length, "large block was not fully parsed");
    var legacyBytes = await bundleBytes("import {javascript} from '@codemirror/legacy-modes/mode/javascript';" +
        "import {python} from '@codemirror/legacy-modes/mode/python';" +
        "import {xml} from '@codemirror/legacy-modes/mode/xml';" +
        "import {css} from '@codemirror/legacy-modes/mode/css';" +
        "import {standardSQL} from '@codemirror/legacy-modes/mode/sql';" +
        "console.log(javascript,python,xml,css,standardSQL);", "legacy-eager.js");
    var nativeBytes = await bundleBytes("import {javascript} from '@codemirror/lang-javascript';" +
        "import {python} from '@codemirror/lang-python';" +
        "import {php} from '@codemirror/lang-php';" +
        "import {xml} from '@codemirror/lang-xml';" +
        "import {css} from '@codemirror/lang-css';" +
        "import {sql} from '@codemirror/lang-sql';" +
        "console.log(javascript,python,php,xml,css,sql);", "native-eager.js");
    var oneNativeChunkBytes = await bundleBytes("import {javascript} from '@codemirror/lang-javascript';" +
        "console.log(javascript);", "native-javascript-chunk.js");
    assert.ok(legacyBytes > 0 && nativeBytes > 0 && oneNativeChunkBytes > 0, "bundle measurement failed");
    console.log("Embedded language bundle bytes: legacy-5=" + legacyBytes + ", native-6=" + nativeBytes +
        ", one-native-chunk=" + oneNativeChunkBytes);
}
async function main() {
    var runtime = loadRuntime();
    testLegacyStreamAdapter();
    testDokuWikiBoundary(runtime);
    testNativeSixLanguagePrototype();
    testStreamLanguageNesting(runtime);
    testBlockScannerAndFallback();
    await testAsyncReload();
    await testLargeBlockAndBundleSize();
    console.log("Embedded language spike passed: legacy adapter, native JS/Python/PHP/XML/CSS/SQL prototype, " +
        "code/file boundaries, alias/fallback, async reload, large block, and bundle-size checks.");
}
main().catch(function(error) { console.error(error.stack || error); process.exitCode = 1; });