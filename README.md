# CodeMirror 6 Plugin for DokuWiki

This plugin adds a CodeMirror editor and syntax highlighting to DokuWiki. It is based on the original [DokuWiki CodeMirror plugin](https://github.com/albertgasset/dokuwiki-plugin-codemirror) and [my modified version](https://github.com/alexdraconian/dokuwiki-plugin-codemirror), but its browser runtime has been migrated from CodeMirror 5 to CodeMirror 6.

## Precautions

* This project is vibe-coded with OpenAI GPT-5.6. Use at your own risk, as I couldn't fully verify it by myself.
* This plugin implements other plugin's syntax by itself; This is intentional choice, since I didn't wanted to revise all other plugins to support this. (I did this for my private wiki, with some additional features, so I wanted to keep change scope minimal.)
* Enabling pageid autocompletion may make your wiki slow, if your wiki have many pages or many active users.
* In case of MathJax plugin, this plugin does not support default `$` and `$$` syntax. Instead, you have to add following code to settings, changing syntax to `<math></math>` and `<MATH></MATH>`. Don't forget to change plugin's `mathtags` setting to `math,MATH`.

```php
MathJax.Hub.Config({
    tex2jax: {
        inlineMath: [ ["<math>","</math>"] ],
        displayMath: [ ["<MATH>","</MATH>"] ],
        processEscapes: true
    }
    // rest of settings...
}
```

## What changed from the original plugin

- Replaced `CodeMirror.fromTextArea()`/`toTextArea()` with a CodeMirror 6 `EditorView` and `EditorState`, connected through an explicit textarea adapter. The adapter keeps DokuWiki save, preview, native-editor switching, focus, and selection behavior intact.
- Preserved DokuWiki's selection and toolbar bridge, including UTF-16 offsets for Korean text and emoji, `pasteText`, headline detection, lock-timer synchronization, size/wrap controls, auto-height, and list-editing commands.
- Ported the DokuWiki parser to CodeMirror 6 `StreamLanguage`/`StreamParser`. Core rules and conditional syntax-plugin rules are separate modules, and plugin rules are enabled from DokuWiki's installed syntax-plugin list. The intentionally disabled `numberedheadings` behavior remains disabled.
- Moved the complete 159-entry `codeModes` language metadata and aliases into an explicit registry. The initial editor bundle is self-contained; larger embedded language implementations are loaded as same-origin optional chunks with deterministic fallback and retry behavior.
- Replaced `CodeMirror.runMode()` read-only highlighting with a one-shot CodeMirror 6 highlighter for `pre.code` blocks. Rendering is text-node based, idempotent, and safe for HTML-like or script-like source text.
- Rebuilt settings around CodeMirror 6 compartments. Existing `cm-*` cookies, font size, themes, keymaps, brackets, line numbers, active line, invisibles, syntax highlighting, and native-editor switching are retained.
- The editor captures `Tab` before browser focus navigation, inserts spaces instead of tab characters, and indents selected lines. The number of spaces is configurable in the settings menu and defaults to 2.
- Added CodeMirror 6 page-name autocomplete to the editor, using the configured DokuWiki page list and preserving page IDs and titles in the completion UI. It uses ajax to bring page IDs from server, respecting page's ACL permissions.
- Added document-wide CodeMirror search and replace. `Ctrl+F` opens the editor search panel, which searches the full document; regular expressions, case sensitivity, whole-word matching, next/previous navigation, and replacement are supported.
- Replaced the old Grunt/CodeMirror 5 production build with TypeScript, esbuild, and Less.

## Installation

End users do not need Node.js. Install the release archive on the DokuWiki server:

1. Download `dokuwiki-plugin-codemirror6.tar.gz` from the release page.
2. Extract it into the DokuWiki plugin directory (`<dokuwiki>/lib/plugins`). The archive already contains the top-level `codemirror6/` directory, so it installs as `<dokuwiki>/lib/plugins/codemirror6`. This is an intentional plugin ID rename from `codemirror`; it is not an in-place upgrade of an existing `codemirror/` installation.
3. Open DokuWiki's Configuration Manager and configure the CodeMirror settings. Enable `codesyntax` if read-only page code blocks should be highlighted. Enable `nativeeditor` only when the browser or site policy requires the native textarea fallback.
4. Open an edit page and confirm that the CodeMirror editor loads. If the browser cannot initialize CM6, the configured native-editor path remains available.

For example, on a Unix-like server:

```sh
tar -xzf dokuwiki-plugin-codemirror6.tar.gz -C /path/to/dokuwiki/lib/plugins
```

The web server must be able to read the extracted files. No CDN, third-party runtime, or Node.js process is required in production.

## Development prerequisites

- Node.js `20.19.0` or newer, but earlier than `25`
- npm `10.8.0` or newer, but earlier than `12`
- A browser supported by the runtime: Chrome/Edge 109+, Firefox 115 ESR+, or Safari 16.4+
- PHP and a DokuWiki installation are needed only for the integration test; the normal unit/build checks do not need PHP

Install the pinned development dependencies with:

```sh
npm ci
```

Use `npm install` instead when creating or updating the lockfile intentionally.

## Build and test

```sh
# Type-check and build the CM6 browser bundles
npm run build

# Run TypeScript and JavaScript syntax checks
npm run lint

# Run golden, parser, editor, bridge, language, and build tests
npm test

# Generate the installable DokuWiki archive
npm run dist
```

`npm run build` writes the self-contained runtime and stylesheet to `dist/cm6/`:

```text
dist/cm6/scripts.min.js
dist/cm6/scripts.min.js.map
dist/cm6/styles.min.css
dist/cm6/styles.min.css.map
dist/cm6/languages/*.js
dist/cm6/languages/*.js.map
```

`npm run dist` rebuilds `dist/` from scratch and creates `dokuwiki-plugin-codemirror6.tar.gz`.

The editor uses CodeMirror's document model for search, so browser `Ctrl+F` is not required to inspect content outside the visible editor viewport. In an edit page, use `Ctrl+F` to open the search panel, `F3` or `Ctrl+G` for the next match, and `Shift+F3` for the previous match.

The repository retains `init.js`, `mode.js`, and the CM5 golden fixtures as historical test oracles for the migration audit. They are not loaded by the plugin and are not included in the release archive.

## Optional DokuWiki integration test

The browser integration test targets a locally running DokuWiki instance. Set the URL and Chrome DevTools endpoint when they differ from the defaults:

```sh
DOKUWIKI_URL=http://localhost:8800 \
DOKUWIKI_CDP_URL=http://localhost:9222 \
npm run test:dokuwiki
```

The verified environment is DokuWiki 2025-05-14b “Librarian” with PHP 8.2.30. The test covers editor lifecycle, saving, preview, selection/toolbar bridges, settings reload, native-editor round trips, static code highlighting, page autocomplete, source/size controls, and browser console errors. DokuWiki 2026-07-14a “Mort” has not been certified by this migration.

## Extending syntax and languages

Core syntax declarations live under `src/language/dokuwiki/syntax/core/`; conditional plugin declarations live under `src/language/dokuwiki/syntax/plugins/`. Add or change a module, add a matching fixture under `tests/fixtures/`, run the CM5/CM6 parity tests, and then run the full test suite.

Embedded language names and aliases are defined in `src/language/embedded/aliases.ts`, with registry metadata in `src/language/embedded/language-registry.ts`. Add the alias, provider/chunk mapping, and a fixture before rebuilding. The loader must continue to use a fixed same-origin asset path; arbitrary paths derived from wiki text are not allowed.

## License

This plugin is distributed under the GNU General Public License, version 2 or later. See [LICENSE](LICENSE) for the complete license text.

Copyright (C) 2014-2017 Albert Gasset.

CodeMirror 6 migration: AlexDraconian.

This repository is a substantially modified work based on the original [DokuWiki CodeMirror plugin](https://github.com/albertgasset/dokuwiki-plugin-codemirror). The original attribution and migration summary are also recorded in[NOTICE](NOTICE). Licenses for packages included in the production bundles are listed in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
