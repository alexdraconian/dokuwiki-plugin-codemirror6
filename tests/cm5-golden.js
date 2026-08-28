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
/* jshint node: true, esversion: 2018 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');
var FIXTURES = path.join(__dirname, 'fixtures');
var EXPECTED = path.join(__dirname, 'expected', 'cm5');
var UPDATE = process.argv.indexOf('--update') !== -1;

function read(file) { return fs.readFileSync(file, 'utf8'); }
function normalize(text) { return text.replace(/\r\n?/g, '\n'); }

function loadCodeModeKeys() {
    var source = read(path.join(ROOT, 'init.js'));
    var start = source.indexOf('var codeModes = {');
    var end = source.indexOf('\n    };', start);
    var body = source.slice(start, end);
    var keys = new Set();
    var pattern = /^\s{8}(?:(['"])(.*?)\1|([A-Za-z0-9_.-]+)):\s*\{/gm;
    var match;

    if (start === -1 || end === -1) {
        throw new Error('Could not locate init.js codeModes registry');
    }
    while ((match = pattern.exec(body)) !== null) {
        keys.add(match[2] || match[3]);
    }
    if (keys.size !== 159) {
        throw new Error('CM5 baseline must contain 159 codeModes keys; found ' + keys.size);
    }
    return keys;
}

function createStream(line) {
    return {
        string: line,
        lineStart: 0,
        pos: 0,
        start: 0,
        sol: function() { return this.pos === this.lineStart; },
        eol: function() { return this.pos >= this.string.length; },
        current: function() { return this.string.slice(this.start, this.pos); },
        next: function() {
            if (this.pos < this.string.length) { return this.string.charAt(this.pos++); }
        },
        match: function(pattern, consume) {
            var rest = this.string.slice(this.pos);
            var match;
            if (typeof pattern === 'string') {
                if (rest.slice(0, pattern.length) !== pattern) { return false; }
                if (consume !== false) { this.pos += pattern.length; }
                return true;
            }
            match = pattern.exec(rest);
            if (!match || match.index !== 0) { return false; }
            if (consume !== false) { this.pos += match[0].length; }
            return match;
        }
    };
}

function loadFactory() {
    var factories = {};
    var codeMirror = {
        defineMode: function(name, factory) { factories[name] = factory; },
        copyState: function(innerMode, state) {
            return innerMode && innerMode.copyState ? innerMode.copyState(state) : state;
        }
    };
    var context = vm.createContext({CodeMirror: codeMirror});
    new vm.Script(read(path.join(ROOT, 'mode.js')), {filename: 'mode.js'})
        .runInContext(context);
    if (!factories.doku) { throw new Error('mode.js did not register doku'); }
    return factories.doku;
}

function parserConfig(relative, registry) {
    var name = path.basename(relative, '.txt');
    var plugins = [];
    if (relative.indexOf('plugins' + path.sep) === 0) {
        plugins = [name === 'numberedheadings-disabled' ? 'numberedheadings' : name];
    }
    return {
        acronyms: ['HTML', 'API'],
        camelcase: true,
        entities: ['&copy;', '&trade;'],
        loadMode: function() {
            return {token: function(stream) { stream.next(); }};
        },
        plugins: plugins,
        schemes: ['https', 'http'],
        smileys: [':)', ':D'],
        validLang: function(lang) { return registry.has(lang); }
    };
}

function filesUnder(directory, extension) {
    var files = [];
    if (!fs.existsSync(directory)) { return files; }
    fs.readdirSync(directory, {withFileTypes: true}).forEach(function(entry) {
        var full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(filesUnder(full, extension));
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
            files.push(full);
        }
    });
    return files.sort();
}

function tokenize(source, mode) {
    var lines = source.split('\n');
    var state = mode.startState ? mode.startState() : undefined;
    var tokens = [];
    var offset = 0;

    lines.forEach(function(line, lineIndex) {
        var stream = createStream(line);
        while (!stream.eol()) {
            var from = stream.pos;
            var styles;
            var attempts = 0;

            stream.start = stream.pos;
            do {
                styles = mode.token(stream, state);
                attempts += 1;
                if (stream.pos > from) { break; }
            } while (attempts < 10);

            if (stream.pos === from) {
                throw new Error(
                    'CM5 mode failed to advance at line ' + (lineIndex + 1) +
                    ', column ' + (from + 1)
                );
            }
            tokens.push({
                from: offset + from,
                to: offset + stream.pos,
                text: line.slice(from, stream.pos),
                styles: styles || null
            });
        }
        if (line.length === 0 && mode.blankLine) { mode.blankLine(state); }
        offset += line.length + (lineIndex < lines.length - 1 ? 1 : 0);
    });
    return tokens;
}

function expectedPath(fixture) {
    return path.join(EXPECTED,
        path.relative(FIXTURES, fixture).replace(/\.txt$/, '.json'));
}

function describeToken(token) {
    return token.from + '-' + token.to + ' ' + JSON.stringify(token.text) +
        ' => ' + (token.styles || 'null');
}

function describeDiff(expected, actual) {
    var index = 0;
    var start;
    var end;
    while (index < expected.length && index < actual.length &&
            JSON.stringify(expected[index]) === JSON.stringify(actual[index])) {
        index += 1;
    }
    start = Math.max(0, index - 2);
    end = Math.min(Math.max(expected.length, actual.length), index + 3);
    return [
        'first differing token index: ' + index,
        'expected length: ' + expected.length + ', actual length: ' + actual.length,
        'expected:',
        expected.slice(start, end).map(function(token, i) {
            return '  [' + (start + i) + '] ' + describeToken(token);
        }).join('\n') || '  <none>',
        'actual:',
        actual.slice(start, end).map(function(token, i) {
            return '  [' + (start + i) + '] ' + describeToken(token);
        }).join('\n') || '  <none>'
    ].join('\n');
}

function writeGolden(file, relative, tokens) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify({
        fixture: relative.split(path.sep).join('/'),
        tokens: tokens,
        version: 1
    }, null, 2) + '\n');
}

function main() {
    var registry = loadCodeModeKeys();
    var factory = loadFactory();
    var fixtures = filesUnder(FIXTURES, '.txt');
    var expectedFiles = filesUnder(EXPECTED, '.json');
    var expectedSet = new Set(fixtures.map(expectedPath));
    var failures = [];
    var updated = 0;

    if (!fixtures.length) { throw new Error('No CM5 fixtures found'); }
    expectedFiles.forEach(function(file) {
        if (!expectedSet.has(file) && !UPDATE) {
            failures.push('orphan expected file: ' + file);
        }
    });

    fixtures.forEach(function(fixture) {
        var relative = path.relative(FIXTURES, fixture);
        var config = parserConfig(relative, registry);
        var source = normalize(read(fixture));
        var actual = tokenize(source, factory({}, config));
        var repeat = tokenize(source, factory({}, config));
        var golden = expectedPath(fixture);

        if (JSON.stringify(actual) !== JSON.stringify(repeat)) {
            failures.push(relative + ': nondeterministic token output');
        } else if (UPDATE) {
            writeGolden(golden, relative, actual);
            updated += 1;
        } else if (!fs.existsSync(golden)) {
            failures.push(relative + ': missing golden; run npm run test:cm5:update');
        } else {
            var expected = JSON.parse(read(golden));
            if (expected.fixture !== relative.split(path.sep).join('/')) {
                failures.push(relative + ': expected fixture name does not match');
            } else if (JSON.stringify(expected.tokens) !== JSON.stringify(actual)) {
                failures.push(relative + ': token mismatch\n' +
                    describeDiff(expected.tokens, actual));
            }
        }
    });

    if (failures.length) {
        console.error(failures.join('\n\n'));
        process.exitCode = 1;
        return;
    }
    console.log(UPDATE ?
        'Updated ' + updated + ' CM5 golden fixture(s).' :
        'CM5 golden tests passed: ' + fixtures.length +
        ' fixture(s), deterministic repeat check passed.');
}

main();
