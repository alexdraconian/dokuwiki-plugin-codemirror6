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
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {readFile, readdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivePath = path.join(root, "dokuwiki-plugin-codemirror6.tar.gz");
const archivePrefix = "codemirror6";
const releaseExtensions = new Set([".css", ".js", ".map"]);
const requiredFiles = [
    "dist/cm6/scripts.min.js",
    "dist/cm6/scripts.min.js.map",
    "dist/cm6/styles.min.css",
    "dist/cm6/styles.min.css.map",
    "NOTICE",
    "THIRD_PARTY_NOTICES.txt",
];

async function filesUnder(directory, predicate) {
    const result = [];
    async function visit(current, relative) {
        for (const entry of await readdir(current, {withFileTypes: true})) {
            const next = path.join(current, entry.name);
            const nextRelative = path.join(relative, entry.name);
            if (entry.isDirectory()) {
                await visit(next, nextRelative);
            } else if (entry.isFile() && predicate(nextRelative)) {
                result.push(nextRelative.replaceAll("\\", "/"));
            }
        }
    }
    await visit(path.join(root, directory), directory);
    return result;
}

async function collectReleaseFiles() {
    const files = [
        "LICENSE",
        "NOTICE",
        "README",
        "THIRD_PARTY_NOTICES.txt",
        "action.php",
        "plugin.info.txt",
        "settings.png",
        ...(await filesUnder("conf", (file) => file.endsWith(".php"))),
        ...(await filesUnder("lang", (file) => file.endsWith(".php"))),
        ...(await filesUnder("dist", (file) => releaseExtensions.has(path.extname(file)))),
    ].sort();

    for (const relative of requiredFiles) {
        if (!(await stat(path.join(root, relative)).catch(() => null))) {
            throw new Error(`Missing required release asset: ${relative}`);
        }
    }
    if (files.some((file) => file.startsWith("dist/legacy/") || file.includes("/keymaps/") || file.includes("/modes/"))) {
        throw new Error("Release contains obsolete CM5 assets");
    }
    return files;
}

function writeOctal(buffer, offset, length, value) {
    const text = Math.max(0, value).toString(8).padStart(length - 1, "0");
    buffer.write(text.slice(-length + 1), offset, length - 1, "ascii");
    buffer[offset + length - 1] = 0;
}

function tarHeader(name, size) {
    const header = Buffer.alloc(512, 0);
    if (Buffer.byteLength(name) > 100) {
        throw new Error(`Archive path is too long for ustar: ${name}`);
    }
    header.write(name, 0, 100, "utf8");
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, size);
    writeOctal(header, 136, 12, 0);
    header[156] = 0x30;
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    header.fill(0x20, 148, 156);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    const checksumText = checksum.toString(8).padStart(6, "0");
    header.write(checksumText, 148, 6, "ascii");
    header[154] = 0;
    header[155] = 0x20;
    return header;
}

const files = await collectReleaseFiles();
const blocks = [];
for (const relative of files) {
    const data = await readFile(path.join(root, relative));
    const name = `${archivePrefix}/${relative}`;
    blocks.push(tarHeader(name, data.length), data);
    const padding = (512 - (data.length % 512)) % 512;
    if (padding) {
        blocks.push(Buffer.alloc(padding));
    }
}
blocks.push(Buffer.alloc(1024));
const archive = gzipSync(Buffer.concat(blocks), {level: 9});
await writeFile(archivePath, archive);
const hash = createHash("sha256").update(archive).digest("hex");
console.log(`Created ${path.basename(archivePath)} (${archive.length} bytes)`);
console.log(`SHA-256: ${hash}`);
console.log(`Release files: ${files.length}`);
for (const file of files) {
    console.log(`  ${archivePrefix}/${file}`);
}
