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
import {readdir} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const names = await readdir(root, {recursive: true});
const files = names
    .filter((name) => name.endsWith(".js"))
    .filter((name) => {
        const normalized = name.replaceAll("\\", "/");
        return !normalized.startsWith("node_modules/") &&
            !normalized.startsWith("dist/") &&
            !normalized.startsWith("tests/expected/") &&
            !normalized.startsWith(".git/");
    })
    .map((name) => path.join(root, name))
    .sort();

for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {stdio: "inherit"});
    if (result.status !== 0) {
        process.exitCode = result.status ?? 1;
        break;
    }
}

if (!process.exitCode) {
    console.log(`JavaScript syntax checks passed: ${files.length} file(s).`);
}