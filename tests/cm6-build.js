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
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');
var CM6_DIST = path.join(ROOT, 'dist', 'cm6');
var JS = path.join(CM6_DIST, 'scripts.min.js');
var JS_MAP = path.join(CM6_DIST, 'scripts.min.js.map');
var CSS = path.join(CM6_DIST, 'styles.min.css');
var CSS_MAP = path.join(CM6_DIST, 'styles.min.css.map');
var LANGUAGE_LEGACY = path.join(CM6_DIST, 'languages', 'legacy.js');
var LANGUAGE_PHP = path.join(CM6_DIST, 'languages', 'php.js');

function read(file) { return fs.readFileSync(file, 'utf8'); }
function assert(condition, message) {
    if (!condition) { throw new Error(message); }
}

function verifySourceMap(file, expectedSource) {
    var map = JSON.parse(read(file));
    assert(Array.isArray(map.sources), file + ' has no sources');
    assert(map.sources.some(function(source) {
        return source.replace(/\\/g, '/').endsWith(expectedSource);
    }), file + ' does not reference ' + expectedSource);
}

assert(fs.existsSync(JS), 'CM6 JavaScript bundle was not built');
assert(fs.existsSync(JS_MAP), 'CM6 JavaScript source map was not built');
assert(fs.existsSync(CSS), 'CM6 CSS bundle was not built');
assert(fs.existsSync(CSS_MAP), 'CM6 CSS source map was not built');
assert(fs.existsSync(LANGUAGE_LEGACY), 'legacy language chunk was not built');
assert(fs.existsSync(LANGUAGE_PHP), 'PHP language chunk was not built');
assert(read(JS).indexOf('//# sourceMappingURL=scripts.min.js.map') !== -1,
    'CM6 JavaScript bundle has no source map reference');
assert(read(JS).indexOf('@codemirror/legacy-modes') === -1,
    'initial CM6 IIFE eagerly contains the legacy language provider');
assert(read(JS).indexOf('@codemirror/lang-php') === -1,
    'initial CM6 IIFE eagerly contains the PHP provider');
assert(read(CSS).indexOf('/*# sourceMappingURL=styles.min.css.map */') !== -1,
    'CM6 CSS bundle has no source map reference');
verifySourceMap(JS_MAP, 'src/main.ts');
verifySourceMap(CSS_MAP, 'cm6.less');

var sandbox = {console: console};
vm.createContext(sandbox);
new vm.Script(read(JS), {filename: JS}).runInContext(sandbox);
assert(sandbox.DokuWikiCodeMirror6, 'CM6 IIFE did not expose its namespace');
assert(typeof sandbox.DokuWikiCodeMirror6.createCm6Runtime === 'function',
    'CM6 IIFE did not expose createCm6Runtime');

var runtime = sandbox.DokuWikiCodeMirror6.createCm6Runtime();
var state = runtime.createState('phase 08');
assert(runtime.version === 'phase-13-settings-and-static-highlight', 'Unexpected CM6 runtime version');
assert(state.doc.toString() === 'phase 08', 'CM6 state did not preserve document text');
assert(typeof runtime.createEditor === 'function',
    'CM6 IIFE did not expose createEditor');
assert(typeof runtime.mountTextArea === 'function',
    'CM6 IIFE did not expose mountTextArea');
assert(typeof runtime.installDokuWikiBridge === 'function',
    'CM6 IIFE did not expose installDokuWikiBridge');
assert(typeof runtime.mountDokuWikiEditor === 'function',
    'CM6 IIFE did not expose mountDokuWikiEditor');
assert(typeof runtime.createDokuWikiParser === 'function',
    'CM6 IIFE did not expose the DokuWiki parser factory');
assert(typeof runtime.createDokuWikiLanguage === 'function',
    'CM6 IIFE did not expose the DokuWiki StreamLanguage factory');
assert(runtime.embeddedLanguageRegistry.keys.length === 159,
    'CM6 IIFE did not expose all code language metadata');
assert(typeof runtime.createEmbeddedLanguageRegistry === 'function',
    'CM6 IIFE did not expose the embedded language registry factory');

console.log('CM6 build verification passed');
