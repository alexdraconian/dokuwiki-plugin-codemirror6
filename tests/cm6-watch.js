"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const {spawn} = require("node:child_process");
const {once} = require("node:events");

const root = path.resolve(__dirname, "..");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const temporary = await fs.mkdtemp(path.join(root, ".cm6-watch-"));
    let child;
    let exited;
    let output = "";
    try {
        await fs.cp(path.join(root, "src"), path.join(temporary, "src"), {recursive: true});
        await fs.mkdir(path.join(temporary, "scripts"));
        await fs.copyFile(path.join(root, "scripts/build.mjs"),
            path.join(temporary, "scripts/build.mjs"));
        await fs.copyFile(path.join(root, "tsconfig.json"), path.join(temporary, "tsconfig.json"));
        await fs.copyFile(path.join(root, "package.json"), path.join(temporary, "package.json"));
        child = spawn(process.execPath, ["scripts/build.mjs", "--watch"], {
            cwd: temporary, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
        });
        exited = once(child, "exit");
        child.stdout.on("data", (chunk) => { output += chunk; });
        child.stderr.on("data", (chunk) => { output += chunk; });
        async function until(check) {
            const deadline = Date.now() + 15000;
            while (Date.now() < deadline) {
                if (await check()) return;
                assert.equal(child.exitCode, null, output);
                await sleep(100);
            }
            throw new Error("Watch build timed out: " + output);
        }
        await until(() => output.includes("CM6 build watching"));
        for (const file of ["scripts.min.js", "styles.min.css", "languages/legacy.js", "languages/php.js"]) {
            assert.ok((await fs.stat(path.join(temporary, "dist/cm6", file))).size > 0, file);
        }
        for (const provider of ["legacy", "php"]) {
            const marker = "watch-regression-" + provider;
            await fs.appendFile(path.join(temporary, "src/language/embedded/providers", provider + ".ts"),
                '\nexport const watchRegression = "' + marker + '";\n');
            await until(async () => (await fs.readFile(
                path.join(temporary, "dist/cm6/languages", provider + ".js"), "utf8",
            )).includes(marker));
        }
        console.log("CM6 watch build passed: initial assets and both provider rebuilds");
    } finally {
        if (child && child.exitCode === null) child.kill();
        if (exited) await exited;
        assert.equal(path.dirname(temporary), root);
        assert.ok(path.basename(temporary).startsWith(".cm6-watch-"));
        await fs.rm(temporary, {recursive: true, force: true});
    }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
