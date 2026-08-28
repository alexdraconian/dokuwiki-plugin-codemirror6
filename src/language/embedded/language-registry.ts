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
import type { LanguageSupport } from "@codemirror/language";

import type { EmbeddedMode } from "../dokuwiki/token-types";
import {
    embeddedLanguageKeys,
    embeddedLanguageSpecs,
    lookupEmbeddedLanguage,
    type EmbeddedLanguageSpec,
} from "./aliases";
import type {
    EmbeddedProviderModule,
    EmbeddedProviderSpan,
} from "./provider-types";

export type EmbeddedLanguageLoadStatus =
    | "failed"
    | "fallback"
    | "loaded"
    | "unknown";

export type EmbeddedLanguageRecordStatus =
    | "failed"
    | "fallback"
    | "idle"
    | "loaded"
    | "loading"
    | "unknown";

export interface EmbeddedLanguageLoadResult {
    readonly alias: string;
    readonly assetUrl: string | null;
    readonly attempts: number;
    readonly error?: unknown;
    readonly mode: EmbeddedMode | null;
    readonly highlighter: ((source: string) => readonly EmbeddedProviderSpan[]) | null;
    readonly spec: EmbeddedLanguageSpec | null;
    readonly status: EmbeddedLanguageLoadStatus;
    readonly support: LanguageSupport | null;
}

export interface EmbeddedLanguageStatus {
    readonly alias: string;
    readonly attempts: number;
    readonly error?: unknown;
    readonly spec: EmbeddedLanguageSpec | null;
    readonly status: EmbeddedLanguageRecordStatus;
}

export type EmbeddedLanguageImport = (
    assetUrl: string,
    spec: EmbeddedLanguageSpec,
) => Promise<EmbeddedProviderModule>;

export interface EmbeddedLanguageRegistryOptions {
    readonly assetBaseUrl?: string;
    readonly importModule?: EmbeddedLanguageImport;
    readonly maxRetries?: number;
}

export interface EmbeddedParserCallbacks {
    readonly loadEmbeddedMode: (alias: string | null) => EmbeddedMode | null;
    readonly validLang: (alias: string) => boolean;
}

type ProviderModuleExport = EmbeddedProviderModule & {
    readonly default?: EmbeddedProviderModule;
    readonly embeddedProvider?: EmbeddedProviderModule;
};

interface LoadingRecord {
    readonly promise: Promise<EmbeddedLanguageLoadResult>;
    readonly status: "loading";
}

interface FinishedRecord {
    readonly result: EmbeddedLanguageLoadResult;
    readonly status: Exclude<EmbeddedLanguageRecordStatus, "idle" | "loading">;
}

type RegistryRecord = FinishedRecord | LoadingRecord;

export type EmbeddedLanguageListener = (
    result: EmbeddedLanguageLoadResult,
) => void;

function defaultImportModule(
    assetUrl: string,
): Promise<EmbeddedProviderModule> {
    // The argument is intentionally dynamic: esbuild leaves this as a native
    // browser import, keeping optional language implementations out of the
    // base IIFE. The URL itself is selected only from the fixed registry.
    return import(assetUrl) as Promise<EmbeddedProviderModule>;
}

function retryCount(value: number | undefined): number {
    return Number.isInteger(value) && (value as number) >= 0 ? value as number : 1;
}

function assetBase(value: string | undefined): string {
    if (!value) {
        return "./languages/";
    }
    return value.endsWith("/") ? value : `${value}/`;
}

function result(
    alias: string,
    spec: EmbeddedLanguageSpec | null,
    status: EmbeddedLanguageLoadStatus,
    attempts: number,
    assetUrl: string | null,
    mode: EmbeddedMode | null = null,
    highlighter: ((source: string) => readonly EmbeddedProviderSpan[]) | null = null,
    support: LanguageSupport | null = null,
    error?: unknown,
): EmbeddedLanguageLoadResult {
    return {
        alias,
        assetUrl,
        attempts,
        error,
        mode,
        highlighter,
        spec,
        status,
        support,
    };
}

function providerOf(module: ProviderModuleExport): EmbeddedProviderModule {
    return module.embeddedProvider ?? module.default ?? module;
}

export class EmbeddedLanguageRegistry {
    readonly specs: readonly EmbeddedLanguageSpec[] = embeddedLanguageSpecs;
    readonly keys: readonly string[] = embeddedLanguageKeys;

    private readonly assetBaseUrl: string;
    private readonly importModule: EmbeddedLanguageImport;
    private readonly maxRetries: number;
    private readonly assetPromises = new Map<
        string,
        Promise<EmbeddedProviderModule>
    >();
    private readonly records = new Map<string, RegistryRecord>();
    private readonly listeners = new Set<EmbeddedLanguageListener>();

    constructor(options: EmbeddedLanguageRegistryOptions = {}) {
        this.assetBaseUrl = assetBase(options.assetBaseUrl);
        this.importModule = options.importModule ?? defaultImportModule;
        this.maxRetries = retryCount(options.maxRetries);
    }

    lookup(alias: string): EmbeddedLanguageSpec | null {
        return lookupEmbeddedLanguage(alias);
    }

    has(alias: string): boolean {
        return this.lookup(alias) !== null;
    }

    assetUrl(alias: string): string | null {
        const spec = this.lookup(alias);
        return spec?.asset ? this.assetBaseUrl + spec.asset : null;
    }

    getStatus(alias: string): EmbeddedLanguageStatus {
        const spec = this.lookup(alias);
        const record = this.records.get(alias);
        if (!record) {
            return {alias, attempts: 0, spec, status: "idle"};
        }
        if (record.status === "loading") {
            return {alias, attempts: 0, spec, status: "loading"};
        }
        return {
            alias,
            attempts: record.result.attempts,
            error: record.result.error,
            spec,
            status: record.status,
        };
    }

    subscribe(listener: EmbeddedLanguageListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getLegacyMode(alias: string | null): EmbeddedMode | null {
        if (!alias) {
            return null;
        }
        const spec = this.lookup(alias);
        if (!spec) {
            return null;
        }
        const record = this.records.get(alias);
        if (record && record.status !== "loading") {
            return record.result.mode;
        }
        if (!record) {
            void this.load(alias);
        }
        return null;
    }

    getLanguageSupport(alias: string): LanguageSupport | null {
        const record = this.records.get(alias);
        if (record && record.status !== "loading") {
            return record.result.support;
        }
        if (!record) {
            void this.load(alias);
        }
        return null;
    }

    parserCallbacks(): EmbeddedParserCallbacks {
        return {
            loadEmbeddedMode: (alias) => this.getLegacyMode(alias),
            validLang: (alias) => this.has(alias),
        };
    }

    load(alias: string): Promise<EmbeddedLanguageLoadResult> {
        const existing = this.records.get(alias);
        if (existing) {
            return existing.status === "loading" ?
                existing.promise : Promise.resolve(existing.result);
        }

        const spec = this.lookup(alias);
        if (!spec) {
            const unknown = Promise.resolve(result(alias, null, "unknown", 0, null));
            this.records.set(alias, {
                result: {
                    alias,
                    assetUrl: null,
                    attempts: 0,
                    mode: null,
                    highlighter: null,
                    spec: null,
                    status: "unknown",
                    support: null,
                },
                status: "unknown",
            });
            return unknown;
        }

        const pending = this.loadSpec(alias, spec).then((loaded) => {
            this.records.set(alias, {result: loaded, status: loaded.status});
            for (const listener of Array.from(this.listeners)) {
                listener(loaded);
            }
            return loaded;
        });
        this.records.set(alias, {promise: pending, status: "loading"});
        return pending;
    }

    retry(alias: string): Promise<EmbeddedLanguageLoadResult> {
        const current = this.records.get(alias);
        if (current?.status === "loading") {
            return current.promise;
        }
        if (current?.status === "loaded") {
            return Promise.resolve(current.result);
        }
        this.records.delete(alias);
        return this.load(alias);
    }

    private async loadSpec(
        alias: string,
        spec: EmbeddedLanguageSpec,
    ): Promise<EmbeddedLanguageLoadResult> {
        const assetUrl = spec.asset ? this.assetBaseUrl + spec.asset : null;
        if (spec.provider === "fallback" || !assetUrl || !spec.providerKey) {
            return result(alias, spec, "fallback", 0, assetUrl);
        }

        let error: unknown;
        const maxAttempts = this.maxRetries + 1;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const module = providerOf(await this.importProvider(assetUrl, spec));
                if (spec.provider === "legacy") {
                    const mode = module.getLegacyMode?.(
                        spec.providerKey,
                        spec.options,
                    );
                    if (!mode) {
                        throw new Error(`No legacy provider for ${alias}`);
                    }
                    return result(alias, spec, "loaded", attempt, assetUrl, mode);
                }

                const highlighter = module.getHighlighter?.(
                    spec.providerKey,
                    spec.options,
                ) ?? null;
                const support = module.getLanguageSupport?.(
                    spec.providerKey,
                    spec.options,
                );
                if (!highlighter && !support) {
                    throw new Error(`No native provider for ${alias}`);
                }
                return result(
                    alias,
                    spec,
                    "loaded",
                    attempt,
                    assetUrl,
                    null,
                    highlighter,
                    support ?? null,
                );
            } catch (caught) {
                error = caught;
                this.assetPromises.delete(assetUrl);
            }
        }

        return result(alias, spec, "failed", maxAttempts, assetUrl, null, null, null, error);
    }

    private importProvider(
        assetUrl: string,
        spec: EmbeddedLanguageSpec,
    ): Promise<EmbeddedProviderModule> {
        const cached = this.assetPromises.get(assetUrl);
        if (cached) {
            return cached;
        }
        const pending = this.importModule(assetUrl, spec);
        this.assetPromises.set(assetUrl, pending);
        return pending;
    }
}

export function createEmbeddedLanguageRegistry(
    options: EmbeddedLanguageRegistryOptions = {},
): EmbeddedLanguageRegistry {
    return new EmbeddedLanguageRegistry(options);
}
