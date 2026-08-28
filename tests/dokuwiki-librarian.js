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
"use strict";

const baseUrl = (process.env.DOKUWIKI_URL || "http://localhost:8800").replace(/\/$/, "");
const cdpUrl = process.env.DOKUWIKI_CDP_URL || "http://127.0.0.1:9222";
const existingPage = baseUrl + "/doku.php?id=playground:playground";
const existingEdit = existingPage + "&do=edit";
const existingSource = existingPage + "&do=source";
const newPage = baseUrl + "/doku.php?id=playground:phase14-librarian";
const newEdit = newPage + "&do=edit";

let socket;
let nextId = 1;
const pending = new Map();
const browserErrors = [];
const completionRequests = [];
const results = [];

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
    results.push(message);
}

function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
        pending.set(id, {resolve, reject});
        socket.send(JSON.stringify({id, method, params}));
    });
}

async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
    });
    if (result.exceptionDetails) {
        throw new Error(
            result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text ||
            "Page evaluation failed",
        );
    }
    return result.result?.value;
}

async function navigate(url) {
    await send("Page.navigate", {url});
    await sleep(1800);
}

async function waitFor(expression, timeout = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (await evaluate(expression)) {
            return;
        }
        await sleep(100);
    }
    throw new Error("Timed out waiting for " + expression);
}

async function openEdit() {
    await navigate(existingEdit);
    await waitFor("Boolean(window.__dokuWikiCodeMirror6?.editor?.settings)");
    await evaluate("window.__dokuWikiCodeMirror6.ready");
}

async function main() {
    const targets = await (await fetch(cdpUrl + "/json/list")).json();
    const target = targets.find((item) => item.type === "page");
    if (!target) {
        throw new Error("No Chrome page target. Start Chrome with remote debugging.");
    }

    socket = new WebSocket(target.webSocketDebuggerUrl);
    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const request = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) {
                request.reject(new Error(message.error.message));
            } else {
                request.resolve(message.result);
            }
            return;
        }
        if (message.method === "Network.requestWillBeSent") {
            const request = message.params.request;
            const postData = request.postData || "";
            if (request.url.includes("/lib/exe/ajax.php") &&
                postData.includes("plugin_codemirror6_page_completion")) {
                completionRequests.push({url: request.url, postData});
            }
        }
        if (
            message.method === "Runtime.exceptionThrown" ||
            (message.method === "Runtime.consoleAPICalled" &&
                message.params.type === "error") ||
            (message.method === "Log.entryAdded" &&
                message.params.entry.level === "error")
        ) {
            const args = message.params.args || [];
            browserErrors.push(message.params.exceptionDetails?.exception?.description ||
                message.params.exceptionDetails?.text ||
                args.map((arg) => arg.value || arg.description || "").join(" ") ||
                message.method);
        }
    });
    await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, {once: true});
        socket.addEventListener("error", reject, {once: true});
    });
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Network.enable");
    await send("Network.setCacheDisabled", {cacheDisabled: true});
    await send("Log.enable");

    await openEdit();
    const initial = await evaluate("(() => { const i = window.__dokuWikiCodeMirror6; const textarea = document.getElementById('wiki__text'); return {mounted: Boolean(i?.editor), cm: Boolean(document.querySelector('.cm-editor')), textareaHidden: textarea?.style.display === 'none', save: Boolean(document.getElementById('edbtn__save')), settings: Boolean(document.querySelector('.cm-settings-button'))}; })()");
    assert(initial.mounted && initial.cm && initial.textareaHidden, "existing edit page mounts CM6 and hides textarea");
    assert(initial.save && initial.settings, "existing edit page exposes save and settings controls");

    const pageCompletion = await evaluate("(() => { const info = window.JSINFO?.plugin_codemirror; const integration = window.__dokuWikiCodeMirror6; return { enabled: info?.pageautocomplete === 1 || info?.pageautocomplete === '1' || info?.pageautocomplete === true, endpoint: info?.pageautocompleteEndpoint || '', call: info?.pageautocompleteCall || '', limit: info?.pageautocompleteLimit, hasPages: Array.isArray(info?.pages), config: integration?.config?.pageautocomplete === true, configEndpoint: integration?.config?.pageautocompleteEndpoint || '' }; })()");
    assert(pageCompletion.enabled && pageCompletion.config &&
      pageCompletion.endpoint && pageCompletion.call &&
      pageCompletion.limit === 30 && !pageCompletion.hasPages &&
      pageCompletion.configEndpoint,
      "test wiki exposes asynchronous page completion configuration");

    const originalCompletionValue = await evaluate("window.__dokuWikiCodeMirror6.editor.port.readValue()");
    await evaluate("(() => { const integration = window.__dokuWikiCodeMirror6; integration.editor.port.writeValue('{{page>playground'); const view = integration.editor.adapter.editor.view; view.dispatch({ selection: { anchor: integration.editor.port.readValue().length } }); view.focus(); return true; })()");
    await evaluate("(() => { const view = window.__dokuWikiCodeMirror6.editor.adapter.editor.view; return view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', code: 'Space', ctrlKey: true, bubbles: true, cancelable: true})); })()");
    await waitFor("Boolean(document.querySelector('.cm-tooltip-autocomplete'))", 3000);
    const completionPopup = await evaluate("(() => { const popup = document.querySelector('.cm-tooltip-autocomplete'); const option = popup?.querySelector('.cm-dw-page-completion'); const detail = option?.querySelector('.cm-completionDetail'); const labels = Array.from(popup?.querySelectorAll('.cm-completionLabel') || []).map((item) => item.textContent || ''); return { open: Boolean(popup), text: popup?.textContent || '', labels, styled: Boolean(option), detailStyle: detail ? getComputedStyle(detail).fontStyle : '', separator: detail ? getComputedStyle(detail).borderLeftStyle : '' }; })()");
    const completionRequest = completionRequests[completionRequests.length - 1];
    assert(completionRequest &&
      completionRequest.postData.includes("limit=30"),
    "Ctrl-Space requests a bounded page completion batch");
    assert(completionPopup.open && completionPopup.text.includes(":") &&
      completionPopup.styled && completionPopup.detailStyle === "normal" &&
      completionPopup.separator === "solid",
    "Ctrl-Space shows separated pageid/title completion styling");
    assert(completionPopup.labels.length > 0 &&
      completionPopup.labels.every((label) => !label.endsWith(":")),
    "page completion popup contains pages only");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await evaluate("(() => { const integration = window.__dokuWikiCodeMirror6; integration.editor.port.writeValue(" + JSON.stringify(originalCompletionValue) + "); integration.editor.port.syncForSubmit(); return true; })()");

    const originalSearchValue = await evaluate("window.__dokuWikiCodeMirror6.editor.port.readValue()");
    const searchResult = await evaluate("(() => { const i = window.__dokuWikiCodeMirror6; const view = i.editor.adapter.editor.view; const lines = []; for (let index = 0; index < 180; index += 1) lines.push('ordinary line ' + index); lines[150] = 'offscreen-search-target'; const source = lines.join(String.fromCharCode(10)); const target = source.indexOf('offscreen-search-target'); i.editor.port.writeValue(source); view.dispatch({selection: {anchor: 0}}); view.focus(); const openEvent = new KeyboardEvent('keydown', {key: 'f', ctrlKey: true, bubbles: true, cancelable: true}); view.contentDOM.dispatchEvent(openEvent); const panel = document.querySelector('.cm-search'); const input = panel?.querySelector('input[name=search]'); if (input) { input.value = 'offscreen-search-target'; input.dispatchEvent(new Event('keyup', {bubbles: true})); } view.focus(); const nextEvent = new KeyboardEvent('keydown', {key: 'F3', bubbles: true, cancelable: true}); view.contentDOM.dispatchEvent(nextEvent); return {open: Boolean(panel), openPrevented: openEvent.defaultPrevented, nextPrevented: nextEvent.defaultPrevented, selected: view.state.selection.main.from, target}; })()");
    assert(searchResult.open && searchResult.openPrevented && searchResult.nextPrevented &&
      searchResult.selected === searchResult.target,
    "Ctrl-F opens CodeMirror search and finds content outside the visible viewport");
    await evaluate("(() => { const i = window.__dokuWikiCodeMirror6; const view = i.editor.adapter.editor.view; view.focus(); view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true})); i.editor.port.writeValue(" + JSON.stringify(originalSearchValue) + "); i.editor.port.syncForSubmit(); return true; })()");

    const bridge = await evaluate('(() => { const i = window.__dokuWikiCodeMirror6; const textarea = document.getElementById("wiki__text"); const value = i.editor.port.readValue(); const needle = "한글"; const start = value.indexOf(needle); i.editor.port.setSelection({start, end: start + needle.length}); const selection = window.DWgetSelection(textarea); const selectedText = selection.geText(); const original = value; const restore = () => { i.editor.port.writeValue(original); i.editor.port.syncForSubmit(); }; const run = (callback) => { i.editor.port.setSelection({start, end: start + needle.length}); callback(); const changed = i.editor.port.readValue(); restore(); return changed; }; const bold = typeof window.insertTags === "function" ? run(() => window.insertTags("wiki__text", "**", "**", "")) : ""; const link = typeof window.pasteText === "function" ? run(() => window.pasteText(window.DWgetSelection(textarea), "[[https://example.com|한글]]", {nosel: true})) : ""; const media = typeof window.pasteText === "function" ? run(() => window.pasteText(window.DWgetSelection(textarea), "{{:wiki:logo.png|미디어}}", {nosel: true})) : ""; return {selectedText, korean: selectedText === needle, bold: bold.includes("**한글**"), link: link.includes("[[https://example.com|한글]]"), media: media.includes("{{:wiki:logo.png|미디어}}"), currentHeadlineLevel: typeof window.currentHeadlineLevel === "function", sizeControl: Boolean(document.getElementById("size__ctl")) && typeof window.dw_editor?.sizeCtl === "function"}; })()');
    assert(bridge.korean, "DokuWiki selection geText preserves Korean UTF-16 range");
    assert(bridge.bold && bridge.link && bridge.media, "DokuWiki bold/link/media insertion APIs round-trip through CM6");
    assert(bridge.currentHeadlineLevel && bridge.sizeControl, "headline and size-control bridge hooks are present");

    const originalSize = await evaluate('(() => { const i = window.__dokuWikiCodeMirror6; const textarea = document.getElementById("wiki__text"); return {cookie: window.DokuCookie?.getValue("sizeCtl") ?? null, height: parseInt(getComputedStyle(textarea).height, 10), hostStyle: i.editor.adapter.host.style.height}; })()');
    const size = await evaluate('(() => { const i = window.__dokuWikiCodeMirror6; const textarea = document.getElementById("wiki__text"); const before = parseInt(getComputedStyle(textarea).height, 10); window.dw_editor.sizeCtl(textarea, 100); const after = parseInt(getComputedStyle(textarea).height, 10); return {before, after, cookie: window.DokuCookie?.getValue("sizeCtl"), host: parseInt(getComputedStyle(i.editor.adapter.host).height, 10)}; })()');
    assert(size.after === size.before + 100 && size.cookie === size.after + "px" && size.host === size.after, "size-control updates CM6 height and persists sizeCtl cookie");
    await openEdit();
    const sizeReloaded = await evaluate('(() => { const i = window.__dokuWikiCodeMirror6; const textarea = document.getElementById("wiki__text"); return {textarea: parseInt(getComputedStyle(textarea).height, 10), host: parseInt(getComputedStyle(i.editor.adapter.host).height, 10), cookie: window.DokuCookie?.getValue("sizeCtl")}; })()');
    assert(sizeReloaded.textarea === size.after && sizeReloaded.host === size.after && sizeReloaded.cookie === size.after + "px", "size-control height survives editor reload");
    await evaluate(`(() => { const i = window.__dokuWikiCodeMirror6; const textarea = document.getElementById("wiki__text"); const original = ${JSON.stringify(originalSize)}; if (original.cookie === null) window.DokuCookie?.setValue("sizeCtl", false); else window.DokuCookie?.setValue("sizeCtl", original.cookie); textarea.style.height = original.height + "px"; i.editor.adapter.host.style.height = original.hostStyle; return true; })()`);

    await navigate(newEdit);
    await waitFor("Boolean(window.__dokuWikiCodeMirror6?.editor)");
    const newInitial = await evaluate("window.__dokuWikiCodeMirror6.editor.port.readValue()");
    const newWasBlank = !newInitial.trim();
    if (newWasBlank) {
        await evaluate("(() => { const i = window.__dokuWikiCodeMirror6; i.editor.port.writeValue('====== Phase 14 Librarian ======' + String.fromCharCode(10, 10) + 'New page save fixture.'); return true; })()");
    }
    const newIsEdit = await evaluate("location.href.includes('do=edit')");
    if (newWasBlank || newIsEdit) {
        await evaluate("document.getElementById('edbtn__save').click()");
        await sleep(2400);
    }
    const newSaved = await evaluate("({url: location.href, title: document.body.innerText.includes('Phase 14 Librarian'), text: document.body.innerText.includes('New page save fixture.')})");
    assert(!newSaved.url.includes("do=edit") && newSaved.title && newSaved.text, "new page save reaches rendered Librarian page");

    await openEdit();
    await evaluate("(() => { const i = window.__dokuWikiCodeMirror6; const marker = 'Stage 14 Librarian browser save'; const current = i.editor.port.readValue(); if (!current.includes(marker)) i.editor.port.replaceText(current.length, current.length, String.fromCharCode(10, 10) + marker); document.getElementById('edbtn__save').click(); return true; })()");
    await sleep(2400);
    const existingSaved = await evaluate("({url: location.href, marker: document.body.innerText.includes('Stage 14 Librarian browser save')})");
    assert(existingSaved.url === existingPage && existingSaved.marker, "existing page save reaches rendered Librarian page");

    await openEdit();
    await evaluate("document.querySelector('.cm-settings-button').click()");
    await waitFor("!document.querySelector('.cm-settings-menu').hidden");
    const menu = await evaluate("(() => { const rect = document.querySelector('.cm-settings-menu').getBoundingClientRect(); return {items: document.querySelectorAll('.cm-settings-menu button[data-setting]').length, dracula: Boolean(document.querySelector('.cm-settings-menu button[data-setting=theme][data-choice=dracula]')), groups: document.querySelectorAll('.cm-settings-menu button[data-submenu]').length, right: rect.right, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight}; })()");
    assert(menu.items >= 60 && menu.dracula && menu.groups === 3, "settings menu renders nested theme/font/keymap groups");
    assert(menu.right <= menu.viewportWidth && menu.bottom <= menu.viewportHeight, "root settings menu stays inside the viewport");
    await evaluate("document.querySelector('.cm-settings-menu button[data-submenu=theme]').click()");
    await waitFor("!document.querySelector('.cm-settings-submenu').hidden");
    const submenu = await evaluate("(() => { const rect = document.querySelector('.cm-settings-submenu').getBoundingClientRect(); return {right: rect.right, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight}; })()");
    assert(submenu.right <= submenu.viewportWidth && submenu.bottom <= submenu.viewportHeight, "nested settings menu stays inside the viewport");
    await evaluate("document.querySelector('.cm-settings-submenu button[data-setting=theme][data-choice=dracula]').click()");
    await sleep(600);
    const nativeBefore = await evaluate("window.__dokuWikiCodeMirror6.editor.settings.get('nativeeditor')");
    if (nativeBefore !== "1") {
        await evaluate("document.querySelector('.cm-settings-menu button[data-setting=nativeeditor]').click()");
        await sleep(600);
    }
    const nativeOn = await evaluate("(() => { const i = window.__dokuWikiCodeMirror6; const textarea = document.getElementById('wiki__text'); return {setting: i.editor.settings.get('nativeeditor'), hidden: i.editor.adapter.host.hidden, active: document.activeElement === textarea}; })()");
    assert(nativeOn.setting === "1" && nativeOn.hidden && nativeOn.active, "native editor mode hides CM6 and focuses textarea");
    await evaluate("(() => { const textarea = document.getElementById('wiki__text'); if (!textarea.value.includes('Stage 14 native roundtrip')) textarea.value += String.fromCharCode(10, 10) + 'Stage 14 native roundtrip'; return true; })()");
    await evaluate("document.querySelector('.cm-settings-menu button[data-setting=nativeeditor]').click()");
    await sleep(800);
    const nativeOff = await evaluate("(() => { const i = window.__dokuWikiCodeMirror6; const textarea = document.getElementById('wiki__text'); return {setting: i.editor.settings.get('nativeeditor'), hidden: i.editor.adapter.host.hidden, marker: i.editor.port.readValue().includes('Stage 14 native roundtrip'), equal: i.editor.port.readValue() === textarea.value}; })()");
    assert(nativeOff.setting === "0" && !nativeOff.hidden && nativeOff.marker && nativeOff.equal, "native editor round-trip restores CM6 text without loss");
    await evaluate("document.getElementById('edbtn__save').click()");
    await sleep(2400);
    await openEdit();
    const reloaded = await evaluate("({theme: window.__dokuWikiCodeMirror6.editor.settings.get('theme'), nativeeditor: window.__dokuWikiCodeMirror6.editor.settings.get('nativeeditor')})");
    assert(reloaded.theme === "dracula" && reloaded.nativeeditor === "0", "settings cookie survives page reload");

    await evaluate("document.getElementById('edbtn__preview').click()");
    await sleep(2200);
    const preview = await evaluate("({marker: document.body.innerText.includes('Stage 14 native roundtrip'), editor: Boolean(document.querySelector('.cm-editor')), button: Boolean(document.getElementById('edbtn__preview'))})");
    assert(preview.marker && preview.editor && preview.button, "preview keeps synchronized content and editor lifecycle");

    await navigate(existingPage);
    const show = await evaluate('(() => { const css = document.querySelector(\'link[href*="/lib/plugins/codemirror6/dist/cm6/styles.min.css"], link[href*="/lib/plugins/codemirror/dist/cm6/styles.min.css"]\'); const js = document.querySelector(\'script[src*="/lib/plugins/codemirror6/dist/cm6/scripts.min.js"], script[src*="/lib/plugins/codemirror/dist/cm6/scripts.min.js"]\'); const blocks = Array.from(document.querySelectorAll("pre.code")); return {assets: Boolean(css && js), ordered: Boolean(css && js && (css.compareDocumentPosition(js) & Node.DOCUMENT_POSITION_FOLLOWING)), marker: document.body.innerText.includes("Stage 14 native roundtrip"), blocks: blocks.map((item) => ({highlighted: item.dataset.codemirror6StaticHighlight === "highlighted", spans: item.querySelectorAll("span").length > 0, img: Boolean(item.querySelector("img")), script: Boolean(item.querySelector("script")), text: item.textContent}))}; })()');
    assert(show.assets && show.ordered, "read view emits CM6 stylesheet before deferred script");
    assert(show.marker && show.blocks.length >= 2 && show.blocks.every((block) => block.highlighted && block.spans && !block.img && !block.script), "code/file blocks are statically highlighted and HTML-safe");
    const screenshot = await send("Page.captureScreenshot", {format: "png", fromSurface: true});
    assert(Boolean(screenshot.data && screenshot.data.length > 1000), "read view visual smoke screenshot is available");

    await navigate(existingSource);
    const source = await evaluate("(() => ({raw: document.body.innerText.includes('<code javascript>'), textarea: Boolean(document.querySelector('textarea')), cm: Boolean(document.querySelector('.cm-editor')), sizeControl: Boolean(document.getElementById('size__ctl'))}))()");
    assert(source.raw && source.textarea && source.cm && source.sizeControl, "source mode keeps raw source and size-control integration available");

    const browserErrorSummary = browserErrors.length ? ": " + browserErrors.join(" | ") : "";
    assert(browserErrors.length === 0, "browser console and exception error count is zero" + browserErrorSummary);
    console.log("DokuWiki Librarian browser integration passed:");
    for (const result of results) {
        console.log("  - " + result);
    }
}

main()
    .catch((error) => {
        console.error(error.stack || error);
        process.exitCode = 1;
    })
    .finally(() => {
        if (socket) {
            socket.close();
        }
    });
