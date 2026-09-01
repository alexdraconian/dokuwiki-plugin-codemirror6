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

function cookieStore(initial) {
    var values = new Map(Object.entries(initial || {}));
    return {
        values: values,
        getValue: function(key) { return values.get(key); },
        setValue: function(key, value) { values.set(key, value); },
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
    return event;
}

async function testStaticHighlighting() {
    var dom = new JSDOM(
        "<!doctype html><div id=\"dokuwiki__content\">" +
        "<pre id=\"php\" class=\"code php\"></pre>" +
        "<pre id=\"unknown\" class=\"code not-a-language\"></pre>" +
        "</div>",
        {pretendToBeVisual: true},
    );
    var php = dom.window.document.getElementById("php");
    var unknown = dom.window.document.getElementById("unknown");
    var source = "<img src=x onerror=alert(1)>";
    php.textContent = source;
    unknown.textContent = "plain <b>text</b>";
    var imports = 0;
    var runtime = loadRuntime(dom.window);
    var registry = runtime.createEmbeddedLanguageRegistry({
        importModule: function() {
            imports += 1;
            return Promise.resolve({
                getHighlighter: function(providerKey) {
                    assert.strictEqual(providerKey, "php");
                    return function(value) {
                        return [{classes: "tok-keyword", from: 0, to: 5}];
                    };
                },
            });
        },
    });

    var before = php.innerHTML;
    await runtime.highlightStaticCodeBlocks(dom.window.document, registry, {
        enabled: false,
    });
    assert.strictEqual(imports, 0, "codesyntax=0 requested a language asset");
    assert.strictEqual(php.innerHTML, before, "disabled highlighting touched DOM");

    var result = await runtime.highlightStaticCodeBlocks(dom.window.document, registry);
    assert.strictEqual(result.blocks, 2);
    assert.strictEqual(result.highlighted, 1);
    assert.strictEqual(result.fallback, 1);
    assert.strictEqual(php.textContent, source, "static highlighting changed source");
    assert.strictEqual(php.querySelectorAll("img").length, 0,
        "source text was interpreted as HTML");
    assert.strictEqual(php.querySelectorAll("span").length, 1,
        "loaded provider did not create a token span");
    assert.strictEqual(unknown.textContent, "plain <b>text</b>");
    assert.strictEqual(unknown.querySelectorAll("span").length, 0,
        "unknown language was not kept plain");

    var spanCount = php.querySelectorAll("span").length;
    var second = await runtime.highlightStaticCodeBlocks(dom.window.document, registry);
    assert.strictEqual(second.highlighted, 1);
    assert.strictEqual(php.querySelectorAll("span").length, spanCount,
        "repeated static highlighting nested markup");
    assert.strictEqual(php.textContent, source);
    assert.strictEqual(imports, 1, "language provider was not deduplicated");
    dom.window.close();
}

async function testSettingsAndMenu() {
    var dom = new JSDOM(
        "<!doctype html><div id=\"size__ctl\"></div><div id=\"host\"></div>",
        {pretendToBeVisual: true},
    );
    var runtime = loadRuntime(dom.window);
    var host = dom.window.document.getElementById("host");
    var cookies = cookieStore({
        "cm-fontsize": "99",
        "cm-linenumbers": "invalid",
        "cm-nativeeditor": "invalid",
        "cm-tabsize": "invalid",
    });
    var editor = runtime.createEditor({parent: host, doc: "one\ntwo"});
    var settings = runtime.createEditorSettings(editor, {
        cookies: cookies,
        config: {nativeeditor: true, usenativescroll: true},
        syntaxExtension: runtime.createDokuWikiLanguage({
            validLang: function() { return false; },
        }),
    });
    await settings.ready;
    editor.setValue("one");
    editor.view.dispatch({
        changes: {from: 3, insert: "!"},
        userEvent: "input",
    });
    var undoEvent = dispatchKey(editor.view, "z", {ctrlKey: true});
    assert.strictEqual(editor.getValue(), "one",
        "Ctrl+Z did not undo the latest edit");
    assert.strictEqual(undoEvent.defaultPrevented, true,
        "Ctrl+Z was not handled by the editor keymap");
    assert.strictEqual(settings.get("fontsize"), "14");
    assert.strictEqual(settings.get("linenumbers"), "0");
    assert.strictEqual(settings.get("nativeeditor"), "1");
    assert.strictEqual(settings.get("tabsize"), "2");
    assert.strictEqual(cookies.values.get("cm-fontsize"), "14");
    assert.strictEqual(cookies.values.get("cm-nativeeditor"), "1");
    assert.strictEqual(cookies.values.get("cm-tabsize"), "2");
    assert.strictEqual(runtime.dokuWikiThemeNames.length, 47);
    assert.strictEqual(runtime.dokuWikiKeymapNames.length, 4);

    var documentText = editor.getValue();
    editor.setSelection(editor.view.state.selection.constructor.single(1, 2));
    var selection = editor.getSelection().main;
    await settings.set("linenumbers", "1");
    await settings.set("activeline", "1");
    await settings.set("closebrackets", "1");
    await settings.set("matchbrackets", "0");
    await settings.set("showinvisibles", "1");
    await settings.set("theme", "dracula");
    await settings.set("fontsize", "18");
    await settings.set("syntax", "0");
    assert.strictEqual(editor.getValue(), documentText,
        "settings changed the document");
    assert.strictEqual(editor.getSelection().main.from, selection.from,
        "settings changed the selection");
    assert.ok(host.querySelector(".cm-gutters"), "line numbers were not enabled");
    assert.ok(host.querySelector(".cm-editor"), "editor was removed by settings");

    var nativeChanges = [];
    await settings.set("nativeeditor", "0");
    settings.subscribe(function(change) {
        if (change.name === "nativeeditor") {
            nativeChanges.push(change.value);
        }
    });
    await settings.set("nativeeditor", "1");
    assert.deepStrictEqual(nativeChanges, ["1"]);

    var deferredResolve;
    var deferred = new Promise(function(resolve) { deferredResolve = resolve; });
    var secondEditor = runtime.createEditor({parent: dom.window.document.createElement("div")});
    var secondSettings = runtime.createEditorSettings(secondEditor, {
        keymapLoader: function() { return deferred; },
    });
    assert.strictEqual(secondSettings.getKeymapState().status, "loading");
    deferredResolve(runtime.dokuWikiKeymapNames.map(function() { return {}; }));
    await secondSettings.ready;
    assert.strictEqual(secondSettings.getKeymapState().status, "loaded");
    secondSettings.dispose();
    secondEditor.destroy();

    var searchOpened = 0;
    var menu = runtime.createDokuWikiSettingsMenu({
        document: dom.window.document,
        controller: settings,
        onOpenSearch: function() { searchOpened += 1; },
        searchLabel: "Find and replace",
    });
    assert.strictEqual(menu.button.getAttribute("aria-haspopup"), "menu");
    assert.strictEqual(menu.menu.getAttribute("role"), "menu");
    var theme = menu.menu.querySelector("button[data-setting=theme][data-choice=dracula]");
    assert.ok(theme, "theme choice was not keyboard-addressable");
    var themeGroup = menu.menu.querySelector("button[data-submenu=theme]");
    var themeSubmenu = menu.menu.querySelector("ul.cm-settings-submenu");
    assert.ok(themeGroup, "theme setting did not create a nested submenu");
    assert.ok(themeSubmenu, "nested settings submenu was not rendered");
    assert.ok(menu.menu.querySelector("button[data-submenu=tabsize]"),
        "tab size setting did not create a nested submenu");
    assert.ok(menu.menu.querySelector("button[data-setting=tabsize][data-choice=2]"),
        "default tab size choice was not rendered");
    assert.strictEqual(themeGroup.getAttribute("aria-haspopup"), "menu");
    assert.strictEqual(themeSubmenu.hidden, true);
    menu.button.click();
    assert.strictEqual(menu.menu.hidden, false);
    menu.button.click();
    assert.strictEqual(menu.menu.hidden, true);
    var native = menu.menu.querySelector("button[data-setting=nativeeditor]");
    var other = menu.menu.querySelector("button[data-setting=theme]");
    var search = menu.menu.querySelector("button[data-action=open-search]");
    assert.ok(search, "find-and-replace action was not rendered");
    assert.strictEqual(search.disabled, true,
        "find-and-replace action was not disabled in native editor mode");
    assert.strictEqual(native.disabled, false);
    assert.strictEqual(other.disabled, true);
    await settings.set("nativeeditor", "0");
    assert.strictEqual(other.disabled, false);
    assert.strictEqual(search.disabled, false,
        "find-and-replace action stayed disabled after returning to CM6");
    search.click();
    assert.strictEqual(searchOpened, 1,
        "find-and-replace action did not invoke its callback");
    menu.destroy();
    settings.dispose();
    editor.destroy();
    dom.window.close();
}

async function testTabIndentation() {
    var dom = new JSDOM(
        "<!doctype html><form id=\"edit\"><textarea id=\"wiki__text\">" +
        "alpha</textarea><button id=\"edbtn__save\"></button></form>",
        {pretendToBeVisual: true},
    );
    var runtime = loadRuntime(dom.window);
    var textarea = dom.window.document.getElementById("wiki__text");
    var mounted = runtime.mountDokuWikiEditor({
        window: dom.window,
        textarea: textarea,
        tabSize: 2,
        settings: {
            config: {nativeeditor: false},
        },
    });
    await mounted.settings.ready;
    assert.strictEqual(mounted.settings.get("tabsize"), "2");
    assert.strictEqual(mounted.adapter.editor.view.state.tabSize, 2);

    mounted.adapter.editor.setSelection(
        mounted.adapter.editor.view.state.selection.constructor.single(2, 2),
    );
    var cursorEvent = dispatchKey(mounted.adapter.editor.view, "Tab");
    assert.strictEqual(cursorEvent.defaultPrevented, true,
        "Tab was not captured by the CodeMirror keymap");
    assert.strictEqual(mounted.adapter.getValue(), "al  pha",
        "Tab did not insert spaces at the cursor");

    await mounted.settings.set("tabsize", "4");
    assert.strictEqual(mounted.adapter.editor.view.state.tabSize, 4);
    assert.strictEqual(mounted.adapter.host.querySelector(".cm-content").style.tabSize, "4");
    mounted.adapter.editor.setValue("one\ntwo\nthree");
    mounted.adapter.editor.setSelection(
        mounted.adapter.editor.view.state.selection.constructor.single(0, 7),
    );
    dispatchKey(mounted.adapter.editor.view, "Tab");
    assert.strictEqual(mounted.adapter.getValue(), "    one\n    two\nthree",
        "Tab did not indent every selected line with spaces");

    mounted.destroy();
    dom.window.close();
}

async function testOfficialCm6Keymaps() {
    var dom = new JSDOM(
        '<!doctype html><div id="vim"></div><div id="sublime"></div>',
        {pretendToBeVisual: true},
    );
    var runtime = loadRuntime(dom.window);
    var vimEditor = runtime.createEditor({
        parent: dom.window.document.getElementById("vim"),
        doc: "abc",
    });
    var vimSettings = runtime.createEditorSettings(vimEditor);
    await vimSettings.set("keymap", "vim");
    assert.strictEqual(vimSettings.getKeymapState().status, "loaded");
    var vimEvent = dispatchKey(vimEditor.view, "l");
    assert.strictEqual(vimEvent.defaultPrevented, true,
        "CM6 Vim keymap did not handle a normal-mode movement");
    assert.strictEqual(vimEditor.view.state.selection.main.head, 1,
        "CM6 Vim keymap did not move the cursor");

    var sublimeEditor = runtime.createEditor({
        parent: dom.window.document.getElementById("sublime"),
        doc: "one one",
    });
    var sublimeSettings = runtime.createEditorSettings(sublimeEditor);
    await sublimeSettings.set("keymap", "sublime");
    sublimeEditor.setSelection(sublimeEditor.view.state.selection.constructor.single(0, 3));
    var sublimeEvent = dispatchKey(sublimeEditor.view, "d", {ctrlKey: true});
    assert.strictEqual(sublimeEvent.defaultPrevented, true,
        "CM6 Sublime keymap did not handle Ctrl-D");
    assert.strictEqual(sublimeEditor.view.state.selection.ranges.length, 2,
        "CM5 Sublime Ctrl-D parity did not select the next occurrence");

    vimSettings.dispose();
    sublimeSettings.dispose();
    vimEditor.destroy();
    sublimeEditor.destroy();
    dom.window.close();
}

Promise.resolve().then(testStaticHighlighting)
    .then(testSettingsAndMenu)
    .then(testTabIndentation)
    .then(testOfficialCm6Keymaps)
    .then(function() {
        console.log("CM6 phase 12/13 and official keymap verification passed");
    })
    .catch(function(error) {
        console.error(error);
        process.exitCode = 1;
    });
