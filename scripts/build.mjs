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
import { watch } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import less from "less";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cm6Dist = path.join(root, "dist", "cm6");
const jsEntry = path.join(root, "src", "main.ts");
const cssEntry = path.join(root, "src", "cm6.less");
const jsOutput = path.join(cm6Dist, "scripts.min.js");
const cssOutput = path.join(cm6Dist, "styles.min.css");
const cssMapOutput = path.join(cm6Dist, "styles.min.css.map");
const languageEntries = {
    "languages/legacy": path.join(root, "src", "language", "embedded", "providers", "legacy.ts"),
    "languages/php": path.join(root, "src", "language", "embedded", "providers", "php.ts"),
};

const jsOptions = {
    bundle: true,
    entryPoints: [jsEntry],
    footer: {
        js: "\n//# sourceMappingURL=scripts.min.js.map",
    },
    format: "iife",
    globalName: "DokuWikiCodeMirror6",
    legalComments: "eof",
    minify: true,
    outfile: jsOutput,
    platform: "browser",
    sourcemap: "external",
    target: ["es2020"],
};

const languageOptions = {
    bundle: true,
    entryPoints: languageEntries,
    format: "esm",
    legalComments: "eof",
    minify: true,
    outdir: cm6Dist,
    platform: "browser",
    sourcemap: "external",
    target: ["es2020"],
};

async function buildStyles() {
    const source = await readFile(cssEntry, "utf8");
    const result = await less.render(source, {
        compress: true,
        filename: cssEntry,
        sourceMap: {
            outputSourceFiles: true,
        },
    });

    await writeFile(
        cssOutput,
        `${result.css.replace(/\s*\/\*# sourceMappingURL=.*?\*\/\s*$/, "").trimEnd()}\n/*# sourceMappingURL=${path.basename(cssMapOutput)} */\n`,
        "utf8",
    );
    await writeFile(cssMapOutput, `${result.map}\n`, "utf8");
}

async function prepareOutput() {
    // A clean dist tree prevents obsolete CM5 files from leaking into a release.
    await rm(path.join(root, "dist"), { force: true, recursive: true });
    await mkdir(cm6Dist, { recursive: true });
}

async function buildOnce() {
    await prepareOutput();
    await Promise.all([
        esbuild.build(jsOptions),
        esbuild.build(languageOptions),
        buildStyles(),
    ]);
}

async function watchBuild() {
    await prepareOutput();
    const context = await esbuild.context(jsOptions);
    await context.rebuild();
    await buildStyles();
    await context.watch();

    let cssTimer;
    const cssWatcher = watch(path.dirname(cssEntry), { recursive: true }, () => {
        clearTimeout(cssTimer);
        cssTimer = setTimeout(() => {
            buildStyles().catch((error) => {
                console.error(error);
            });
        }, 50);
    });

    console.log("CM6 build watching src/**/*.ts and src/**/*.less");

    await new Promise((resolve) => {
        let stopped = false;
        const stop = async () => {
            if (stopped) {
                return;
            }
            stopped = true;
            clearTimeout(cssTimer);
            cssWatcher.close();
            await context.dispose();
            resolve();
        };

        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
    });
}

if (process.argv.includes("--watch")) {
    await watchBuild();
} else {
    await buildOnce();
}
