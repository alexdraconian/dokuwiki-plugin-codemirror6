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
import {
    autocompletion,
    CompletionContext,
    type Completion,
    type CompletionResult,
    type CompletionSource,
} from "@codemirror/autocomplete";
import type {Extension} from "@codemirror/state";
import type {DokuWikiPage} from "../dokuwiki/config";

export type {DokuWikiPage} from "../dokuwiki/config";

export interface DokuWikiPageCompletionOptions {
    readonly endpoint?: string;
    readonly call?: string;
    readonly namespace?: string;
    readonly limit?: number;
    readonly debounceMs?: number;
    readonly fetch?: typeof fetch;
}

interface CompletionTarget {
    readonly from: number;
    readonly to: number;
    readonly query: string;
}

interface PageCompletionResponse {
    readonly items?: unknown;
}

const pageCompletionOptionClass = "cm-dw-page-completion";
const defaultCall = "plugin_codemirror6_page_completion";
const defaultLimit = 30;
const maxLimit = 50;
const defaultDebounceMs = 350;

function normalizedPage(page: unknown): DokuWikiPage | null {
    if (!page || typeof page !== "object") {
        return null;
    }

    const value = page as {pageid?: unknown; title?: unknown; kind?: unknown};
    const pageid = typeof value.pageid === "string" ?
        value.pageid.trim().replace(/^:+/, "") : "";
    if (!pageid) {
        return null;
    }

    const title = typeof value.title === "string" ? value.title : "";
    if (value.kind === "namespace") {
        return null;
    }
    return {pageid, title, kind: "page"};
}

function normalizedPages(value: unknown): readonly DokuWikiPage[] {
    if (!Array.isArray(value)) {
        return Object.freeze([]);
    }

    const seen = new Set<string>();
    const result: DokuWikiPage[] = [];
    for (const item of value) {
        const normalized = normalizedPage(item);
        if (!normalized || seen.has(normalized.pageid)) {
            continue;
        }
        seen.add(normalized.pageid);
        result.push(normalized);
    }
    return Object.freeze(result);
}

function responsePages(value: unknown): readonly DokuWikiPage[] {
    if (!value || typeof value !== "object") {
        return Object.freeze([]);
    }
    return normalizedPages((value as PageCompletionResponse).items);
}

function completionTarget(
    context: CompletionContext,
    namespace: string,
): CompletionTarget {
    const match = context.matchBefore(/[^\s\[\]\|{}<>()"'\x60>]*$/);
    const from = match?.from ?? context.pos;
    const rawTarget = match?.text ?? "";
    const currentNamespace = namespace.trim().replace(/^:+|:+$/g, "");
    return {
        from,
        to: context.pos,
        query: rawTarget || (currentNamespace ? currentNamespace + ":" : ""),
    };
}

function completionFor(page: DokuWikiPage): Completion {
    const absolutePageid = ":" + page.pageid;
    return {
        label: absolutePageid,
        detail: page.title,
        apply: absolutePageid,
        type: "text",
        sortText: page.pageid,
    };
}

function isAbortError(error: unknown): boolean {
    return !!error && typeof error === "object" &&
        (error as {name?: unknown}).name === "AbortError";
}

function boundedLimit(value: number | undefined): number {
    return Number.isFinite(value) && value !== undefined ?
        Math.min(maxLimit, Math.max(1, Math.floor(value))) : defaultLimit;
}

function boundedDebounce(value: number | undefined): number {
    return Number.isFinite(value) && value !== undefined ?
        Math.max(0, Math.floor(value)) : defaultDebounceMs;
}

export function createDokuWikiPageCompletionSource(
    options: DokuWikiPageCompletionOptions,
): CompletionSource {
    const endpoint = options.endpoint?.trim() ?? "";
    const call = options.call?.trim() || defaultCall;
    const namespace = options.namespace ?? "";
    const limit = boundedLimit(options.limit);
    const debounceMs = boundedDebounce(options.debounceMs);
    const fetcher = options.fetch ??
        (typeof globalThis.fetch === "function" ?
            globalThis.fetch.bind(globalThis) : null);

    let requestSerial = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingResolve: ((result: CompletionResult | null) => void) | null = null;
    let controller: AbortController | null = null;

    return (context): Promise<CompletionResult | null> => {
        const target = completionTarget(context, namespace);
        const requestId = ++requestSerial;

        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        if (pendingResolve !== null) {
            pendingResolve(null);
            pendingResolve = null;
        }
        if (controller !== null) {
            controller.abort();
            controller = null;
        }

        if (!endpoint || fetcher === null) {
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            pendingResolve = resolve;
            timer = setTimeout(() => {
                timer = null;
                pendingResolve = null;
                const requestController = typeof AbortController === "function" ?
                    new AbortController() : null;
                controller = requestController;

                void (async () => {
                    try {
                        const params = new URLSearchParams();
                        params.set("call", call);
                        params.set("q", target.query);
                        params.set("limit", String(limit));
                        const response = await fetcher(endpoint, {
                            method: "POST",
                            body: params,
                            credentials: "same-origin",
                            headers: {"Accept": "application/json"},
                            signal: requestController?.signal,
                        });
                        if (!response.ok) {
                            throw new Error(
                                "Page completion request failed: " + response.status,
                            );
                        }

                        const pages = responsePages(await response.json());
                        if (requestId !== requestSerial) {
                            resolve(null);
                            return;
                        }

                        const matches = pages.map(completionFor);
                        resolve(matches.length ? {
                            from: target.from,
                            to: target.to,
                            options: matches,
                            filter: false,
                        } : null);
                    } catch (error) {
                        if (requestId === requestSerial && !isAbortError(error)) {
                            console.error("DokuWiki page completion failed", error);
                        }
                        resolve(null);
                    } finally {
                        if (requestId === requestSerial) {
                            controller = null;
                        }
                    }
                })();
            }, debounceMs);
        });
    };
}

/** Adds Ctrl-Space page completion at any cursor position. */
export function createDokuWikiPageCompletion(
    options: DokuWikiPageCompletionOptions,
): Extension {
    if (!options.endpoint?.trim()) {
        return [];
    }

    return autocompletion({
        activateOnTyping: false,
        override: [createDokuWikiPageCompletionSource(options)],
        optionClass: (completion) => completion.type === "text" ?
            pageCompletionOptionClass : "",
    });
}
