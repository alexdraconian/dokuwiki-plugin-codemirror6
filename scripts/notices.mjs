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
import {readdir, readFile, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = path.join(root, "node_modules");
const output = path.join(root, "THIRD_PARTY_NOTICES.txt");

// These are the packages imported by the production entry points. The
// remaining notices are discovered by following their runtime dependencies.
const runtimeRoots = [
    "@codemirror/autocomplete",
    "@codemirror/commands",
    "@codemirror/lang-css",
    "@codemirror/lang-javascript",
    "@codemirror/lang-php",
    "@codemirror/lang-python",
    "@codemirror/lang-sql",
    "@codemirror/lang-xml",
    "@codemirror/language",
    "@codemirror/legacy-modes",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/highlight",
    "@replit/codemirror-vim",
];

function packageDirectory(name) {
    return path.join(nodeModules, ...name.split("/"));
}

async function packageInfo(name) {
    const directory = packageDirectory(name);
    const packageFile = path.join(directory, "package.json");
    const metadata = JSON.parse(await readFile(packageFile, "utf8"));
    return {directory, metadata};
}

async function licenseFile(directory) {
    const entries = await readdir(directory, {withFileTypes: true});
    const candidates = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => /^(?:license|copying|notice)(?:[.-].*)?$/i.test(name))
        .sort((left, right) => left.localeCompare(right));
    return candidates[0] ?? null;
}

function licenseName(metadata) {
    if (typeof metadata.license === "string") {
        return metadata.license;
    }
    if (metadata.license && typeof metadata.license.type === "string") {
        return metadata.license.type;
    }
    if (Array.isArray(metadata.licenses)) {
        return metadata.licenses.map((entry) => (
            typeof entry === "string" ? entry : entry?.type
        )).filter(Boolean).join(" OR ") || "SEE PACKAGE METADATA";
    }
    return "SEE PACKAGE METADATA";
}

function repositoryUrl(metadata) {
    const repository = metadata.repository;
    if (typeof repository === "string") {
        return repository;
    }
    if (repository && typeof repository.url === "string") {
        return repository.url;
    }
    return null;
}

const packages = new Map();
const pending = [...runtimeRoots];
while (pending.length) {
    const name = pending.shift();
    if (packages.has(name)) {
        continue;
    }
    const info = await packageInfo(name);
    packages.set(name, info);
    for (const dependency of Object.keys(info.metadata.dependencies ?? {})) {
        pending.push(dependency);
    }
    for (const dependency of Object.keys(info.metadata.optionalDependencies ?? {})) {
        pending.push(dependency);
    }
}

const sections = [];
for (const name of Array.from(packages.keys()).sort((left, right) => left.localeCompare(right))) {
    const {directory, metadata} = packages.get(name);
    const file = await licenseFile(directory);
    const text = file ?
        (await readFile(path.join(directory, file), "utf8"))
            .replaceAll("\r\n", "\n").trimEnd() :
        "License text was not shipped as a separate file; see the package metadata.";
    const repository = repositoryUrl(metadata);
    sections.push([
        "-------------------------------------------------------------------------------",
        "Package: " + name,
        "Version: " + (metadata.version ?? "unknown"),
        "License: " + licenseName(metadata),
        ...(repository ? ["Repository: " + repository] : []),
        "License file: " + (file ?? "package metadata"),
        "",
        text,
    ].join("\n"));
}

const header = [
    "Third-party license notices",
    "===========================",
    "",
    "The production bundles in this plugin include the packages listed below.",
    "This file is generated from the installed package metadata and license files",
    "by scripts/notices.mjs; it is included in the deployment archive.",
    "",
].join("\n");

await writeFile(output, header + sections.join("\n\n") + "\n", "utf8");
const bytes = (await stat(output)).size;
console.log("Wrote " + path.relative(root, output) + " (" + bytes + " bytes, " +
    packages.size + " packages)");
