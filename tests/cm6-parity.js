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
var StringStream = require("@codemirror/language").StringStream;

var ROOT = path.resolve(__dirname, "..");
var FIXTURES = path.join(__dirname, "fixtures", "core");
var EXPECTED = path.join(__dirname, "expected", "cm5", "core");
var PLUGIN_FIXTURES = path.join(__dirname, "fixtures", "plugins");
var PLUGIN_EXPECTED = path.join(__dirname, "expected", "cm5", "plugins");
var BUNDLE = path.join(ROOT, "dist", "cm6", "scripts.min.js");

function read(file) { return fs.readFileSync(file, "utf8"); }
function normalize(text) { return text.replace(/\r\n?/g, "\n"); }

function loadRuntime() {
    var sandbox = {console: console};
    vm.createContext(sandbox);
    new vm.Script(read(BUNDLE), {filename: BUNDLE}).runInContext(sandbox);
    return sandbox.DokuWikiCodeMirror6.createCm6Runtime();
}

function parserConfig(plugins) {
    var languages = new Set(["html", "php", "javascript", "python", "js"]);
    return {
        acronyms: ["HTML", "API"],
        camelcase: true,
        entities: ["&copy;", "&trade;"],
        plugins: plugins || [],
        schemes: ["https", "http"],
        smileys: [":)", ":D"],
        validLang: function(lang) { return languages.has(lang); },
    };
}

function tokenize(source, parser) {
    var lines = source.split("\n");
    var state = parser.startState ? parser.startState(4) : undefined;
    var tokens = [];
    var offset = 0;

    lines.forEach(function(line, lineIndex) {
        var stream = new StringStream(line, 8, 4);
        while (!stream.eol()) {
            var from = stream.pos;
            var styles;
            var attempts = 0;
            stream.start = stream.pos;
            do {
                styles = parser.token(stream, state);
                attempts += 1;
                if (stream.pos > from) { break; }
            } while (attempts < 10);
            if (stream.pos === from) {
                throw new Error(
                    "CM6 mode failed to advance at line " + (lineIndex + 1) +
                    ", column " + (from + 1),
                );
            }
            tokens.push({
                from: offset + from,
                to: offset + stream.pos,
                text: line.slice(from, stream.pos),
                styles: styles || null,
            });
        }
        if (line.length === 0 && parser.blankLine) {
            parser.blankLine(state, 4);
        }
        offset += line.length + (lineIndex < lines.length - 1 ? 1 : 0);
    });
    return tokens;
}

function fixtureFiles() {
    return fs.readdirSync(FIXTURES)
        .filter(function(file) { return file.endsWith(".txt"); })
        .sort();
}

function compareCoreFixtures(runtime) {
    var parser = runtime.createDokuWikiParser(parserConfig());
    fixtureFiles().forEach(function(file) {
        var relative = path.join("core", file).replace(/\\/g, "/");
        var source = normalize(read(path.join(FIXTURES, file)));
        var expected = JSON.parse(read(path.join(EXPECTED, file.replace(/\.txt$/, ".json"))));
        var actual = tokenize(source, parser);
        assert.strictEqual(
            JSON.stringify(actual),
            JSON.stringify(expected.tokens),
            relative + " differs from the CM5 golden fixture",
        );
    });
    return fixtureFiles().length;
}

function comparePluginFixtures(runtime) {
    var files = fs.readdirSync(PLUGIN_FIXTURES)
        .filter(function(file) { return file.endsWith(".txt"); })
        .sort();

    files.forEach(function(file) {
        var plugin = file.replace(/\.txt$/, "");
        var plugins = [
            plugin === "numberedheadings-disabled"
                ? "numberedheadings"
                : plugin,
        ];
        var source = normalize(read(path.join(PLUGIN_FIXTURES, file)));
        var expected = JSON.parse(read(path.join(
            PLUGIN_EXPECTED,
            file.replace(/\.txt$/, ".json"),
        )));
        var actual = tokenize(
            source,
            runtime.createDokuWikiParser(parserConfig(plugins)),
        );
        assert.strictEqual(
            JSON.stringify(actual),
            JSON.stringify(expected.tokens),
            "plugin/" + file + " differs from the CM5 golden fixture",
        );
    });

    return files.length;
}

function testPluginRegistry(runtime) {
    var expected = fs.readdirSync(PLUGIN_FIXTURES)
        .filter(function(file) { return file.endsWith(".txt"); })
        .map(function(file) {
            var name = file.replace(/\.txt$/, "");
            return name === "numberedheadings-disabled" ? "numberedheadings" : name;
        })
        .sort();
    var actual = Array.from(runtime.dokuWikiPluginSyntaxModules)
        .map(function(module) { return module.plugin; })
        .sort();
    assert.deepStrictEqual(actual, expected,
        "plugin registry must cover every documented plugin fixture");
    var disabled = runtime.dokuWikiPluginSyntaxModules.find(function(module) {
        return module.plugin === "numberedheadings";
    });
    assert.ok(disabled, "numberedheadings registry entry is missing");
    assert.strictEqual(disabled.enabled, false,
        "numberedheadings must remain intentionally disabled");
    assert.strictEqual(disabled.rules.length, 0,
        "disabled numberedheadings must not register rules");
}

function testPluginNotInstalled(runtime) {
    var source = "~~INFO:syntaxplugins~~";
    var withoutPlugin = tokenize(
        source,
        runtime.createDokuWikiParser(parserConfig()),
    );
    var withPlugin = tokenize(
        source,
        runtime.createDokuWikiParser(parserConfig(["info"])),
    );
    assert.ok(withoutPlugin.every(function(token) {
        return token.styles !== "meta";
    }), "plugin syntax was active without installation");
    assert.ok(withPlugin.some(function(token) {
        return token.styles === "meta";
    }), "installed plugin syntax did not activate");
}

function testEmbeddedBoundary(runtime) {
    var parser = runtime.createDokuWikiParser({
        validLang: function(lang) { return lang === "js"; },
    });
    var tokens = tokenize("<code js>body</code> after", parser);
    var close = tokens.find(function(token) { return token.text === "</code>"; });
    assert.ok(close, "code closing boundary was not recognized");
    assert.strictEqual(close.styles, "tag");
    assert.ok(tokens.some(function(token) {
        return token.from >= close.to && token.styles === null;
    }), "outer parsing did not resume after a code block");
}

function testStreamLanguage(runtime) {
    var language = runtime.createDokuWikiLanguage(parserConfig());
    var state = runtime.createState("**StreamLanguage**", language);
    var tree = runtime.syntaxTree(state);
    assert.strictEqual(tree.length, state.doc.length,
        "StreamLanguage did not parse the complete document");
}

function testCopyState(runtime) {
    var embeddedMode = {
        copyState: function(state) {
            return {items: state.items.slice()};
        },
        startState: function() { return {items: []}; },
        token: function(stream) { stream.next(); return null; },
    };
    var parser = runtime.createDokuWikiParser({
        validLang: function() { return true; },
        loadEmbeddedMode: function() { return embeddedMode; },
    });
    var original = parser.startState(4);
    original.stack.push(original.current);
    original.temp.marker = "original";
    original.innerMode = embeddedMode;
    original.innerState = {items: ["one"]};
    var copy = parser.copyState(original);

    assert.notStrictEqual(copy.stack, original.stack, "stack was shallow-copied");
    assert.notStrictEqual(copy.temp, original.temp, "temp was shared");
    assert.notStrictEqual(copy.innerState, original.innerState,
        "inner state was shallow-copied");
    copy.stack.pop();
    copy.innerState.items.push("two");
    assert.strictEqual(original.stack.length, 1, "copy changed original stack");
    assert.deepStrictEqual(original.innerState.items, ["one"],
        "copy changed original inner state");
}

function testLongInput(runtime) {
    var lines = [];
    for (var i = 0; i < 2000; i += 1) {
        lines.push("  * **항목 " + i + "** https://example.test/" + i);
    }
    var tokens = tokenize(lines.join("\n"), runtime.createDokuWikiParser(parserConfig()));
    assert.ok(tokens.length > 2000, "long input was not fully tokenized");
}

function main() {
    var runtime = loadRuntime();
    var count = compareCoreFixtures(runtime);
    var pluginCount = comparePluginFixtures(runtime);
    testPluginNotInstalled(runtime);
    testPluginRegistry(runtime);
    testStreamLanguage(runtime);
    testEmbeddedBoundary(runtime);
    testCopyState(runtime);
    testLongInput(runtime);
    console.log("CM6 core/plugin parity passed: " + count + " core and " +
        pluginCount + " plugin fixture(s), activation, embedded boundary, " +
        "copyState, and long-input checks.");
}

main();
