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
    EditorState,
    StateEffect,
    StateField,
    type Extension,
} from "@codemirror/state";
import {
    ensureSyntaxTree,
    StreamLanguage,
    syntaxTree,
    type StreamParser,
} from "@codemirror/language";
import {
    classHighlighter,
    highlightTree,
} from "@lezer/highlight";
import {
    Decoration,
    EditorView,
    ViewPlugin,
    type DecorationSet,
    type ViewUpdate,
} from "@codemirror/view";

import type {EmbeddedLanguageLoadResult, EmbeddedLanguageRegistry} from "./language-registry";

export interface EmbeddedCodeBlock {
    readonly closed: boolean;
    readonly filename: string | null;
    readonly from: number;
    readonly kind: "code" | "file";
    readonly lang: string;
    readonly to: number;
}

export interface EmbeddedHighlightSpan {
    readonly classes: string;
    readonly from: number;
    readonly to: number;
}

export interface EmbeddedBlockHighlight {
    readonly block: EmbeddedCodeBlock;
    readonly result: EmbeddedLanguageLoadResult;
    readonly spans: readonly EmbeddedHighlightSpan[];
}

interface IndexedEmbeddedCodeBlock {
    readonly block: EmbeddedCodeBlock;
    readonly openFrom: number;
    readonly after: number;
}

interface CachedEmbeddedBlock {
    readonly alias: string;
    readonly result: EmbeddedLanguageLoadResult;
    readonly spans: readonly EmbeddedHighlightSpan[];
}

function scanIndexedEmbeddedCodeBlocks(
    source: string,
    start = 0,
): readonly IndexedEmbeddedCodeBlock[] {
    const blocks: IndexedEmbeddedCodeBlock[] = [];
    const opener = /<(code|file)(?=\s|>)([^>]*)>/g;
    opener.lastIndex = Math.max(0, Math.min(source.length, start));
    let match: RegExpExecArray | null;
    while ((match = opener.exec(source))) {
        const kind = match[1] as "code" | "file";
        const params = match[2].trim().split(/\s+/).filter(Boolean);
        const closeTag = `</${kind}>`;
        const from = match.index + match[0].length;
        const close = source.indexOf(closeTag, from);
        const after = close === -1 ? source.length : close + closeTag.length;
        blocks.push({
            block: {
                closed: close !== -1,
                filename: params[1] ?? null,
                from,
                kind,
                lang: params[0] ?? "text",
                to: close === -1 ? source.length : close,
            },
            openFrom: match.index,
            after,
        });
        opener.lastIndex = after;
    }
    return blocks;
}

/**
 * Scans only the code/file boundaries owned by the DokuWiki parser. The
 * embedded provider receives the resulting body range and cannot consume the
 * closing tag or the following document text.
 */
export function scanEmbeddedCodeBlocks(source: string): readonly EmbeddedCodeBlock[] {
    return scanIndexedEmbeddedCodeBlocks(source).map(({block}) => block);
}

function collectSpans(
    state: EditorState,
    offset: number,
): readonly EmbeddedHighlightSpan[] {
    const tree = ensureSyntaxTree(state, state.doc.length, 5000) ?? syntaxTree(state);
    const spans: EmbeddedHighlightSpan[] = [];
    highlightTree(tree, classHighlighter, (from, to, classes) => {
        if (from < to) {
            spans.push({classes, from: offset + from, to: offset + to});
        }
    });
    return spans;
}

function highlightBlockBody(
    body: string,
    offset: number,
    loaded: EmbeddedLanguageLoadResult,
): readonly EmbeddedHighlightSpan[] {
    if (loaded.highlighter) {
        return loaded.highlighter(body).map((span) => ({
            classes: span.classes,
            from: offset + span.from,
            to: offset + span.to,
        }));
    }
    if (loaded.mode) {
        const language = StreamLanguage.define(
            loaded.mode as unknown as StreamParser<unknown>,
        );
        const state = EditorState.create({doc: body, extensions: [language]});
        return collectSpans(state, offset);
    }
    if (loaded.support) {
        const state = EditorState.create({
            doc: body,
            extensions: [loaded.support.extension],
        });
        return collectSpans(state, offset);
    }
    return [];
}

export async function highlightEmbeddedBlock(
    source: string,
    block: EmbeddedCodeBlock,
    registry: EmbeddedLanguageRegistry,
): Promise<EmbeddedBlockHighlight> {
    const loaded = await registry.load(block.lang);
    return {
        block,
        result: loaded,
        spans: highlightBlockBody(source.slice(block.from, block.to), block.from, loaded),
    };
}

export async function highlightEmbeddedDocument(
    source: string,
    registry: EmbeddedLanguageRegistry,
): Promise<readonly EmbeddedBlockHighlight[]> {
    return Promise.all(scanEmbeddedCodeBlocks(source).map((block) => (
        highlightEmbeddedBlock(source, block, registry)
    )));
}

function decorationsFor(
    blocks: readonly EmbeddedBlockHighlight[],
): DecorationSet {
    const ranges = blocks.flatMap((block) => block.spans.map((span) => (
        Decoration.mark({class: span.classes}).range(span.from, span.to)
    )));
    return ranges.length ? Decoration.set(ranges, true) : Decoration.none;
}

function cacheKey(source: string, block: EmbeddedCodeBlock): string {
    return JSON.stringify([
        block.kind,
        block.lang,
        block.filename,
        block.closed,
        source.slice(block.from, block.to),
    ]);
}

function withAbsoluteSpans(
    block: EmbeddedCodeBlock,
    cached: CachedEmbeddedBlock,
): EmbeddedBlockHighlight {
    return {
        block,
        result: cached.result,
        spans: cached.spans.map((span) => ({
            classes: span.classes,
            from: block.from + span.from,
            to: block.from + span.to,
        })),
    };
}

const embeddedRefreshDebounceMs = 100;
const maxCachedEmbeddedBlocks = 128;

/**
 * Adds an asynchronous, block-scoped overlay to an editor. Document edits are
 * coalesced and only the suffix beginning at the first affected embedded
 * boundary is rescanned. Block results are cached by their body and metadata,
 * so moving an unchanged block does not invoke its provider again. A provider
 * load invalidates only that provider's cached blocks.
 */
export function createEmbeddedLanguageHighlighting(
    registry: EmbeddedLanguageRegistry,
    onLanguageLoad?: () => void,
): Extension {
    const setDecorations = StateEffect.define<DecorationSet>();
    const decorations = StateField.define<DecorationSet>({
        create: () => Decoration.none,
        update(value, transaction) {
            for (const effect of transaction.effects) {
                if (effect.is(setDecorations)) {
                    return effect.value;
                }
            }
            return transaction.docChanged ? Decoration.none : value.map(transaction.changes);
        },
        provide: (field) => EditorView.decorations.from(field),
    });

    const plugin = ViewPlugin.fromClass(class {
        private disposed = false;
        private generation = 0;
        private running = false;
        private timer: ReturnType<typeof setTimeout> | null = null;
        private pendingStart: number | null = null;
        private pendingImmediate = false;
        private indexedBlocks: readonly IndexedEmbeddedCodeBlock[] = [];
        private readonly cache = new Map<string, CachedEmbeddedBlock>();
        private readonly unsubscribe: () => void;

        constructor(private readonly view: EditorView) {
            this.unsubscribe = registry.subscribe((result) => {
                for (const [key, cached] of this.cache) {
                    if (cached.alias === result.alias) {
                        this.cache.delete(key);
                    }
                }
                // The DokuWiki stream parser captures an embedded mode in its
                // state when it sees the opening tag. Recreate that parser so
                // already-open code/math blocks can use a mode that finished
                // loading without requiring a document edit.
                onLanguageLoad?.();
                this.requestRefresh(0, true);
            });
            this.requestRefresh(0, true);
        }

        update(update: ViewUpdate): void {
            if (update.docChanged) {
                const start = this.running || this.timer !== null ?
                    0 : this.rescanStart(update.changes);
                this.requestRefresh(start, false);
            }
        }

        destroy(): void {
            this.disposed = true;
            this.generation += 1;
            if (this.timer !== null) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            this.pendingStart = null;
            this.unsubscribe();
        }

        private rescanStart(changes: ViewUpdate["changes"]): number {
            let firstChange = Number.POSITIVE_INFINITY;
            changes.iterChangedRanges((from) => {
                firstChange = Math.min(firstChange, from);
            });
            if (!Number.isFinite(firstChange)) {
                return 0;
            }

            const containing = this.indexedBlocks.find(({openFrom, after}) => (
                firstChange >= openFrom && firstChange < after
            ));
            if (containing) {
                return containing.openFrom;
            }

            let safeStart = 0;
            for (const indexed of this.indexedBlocks) {
                if (indexed.after > firstChange) {
                    break;
                }
                safeStart = indexed.after;
            }
            return safeStart;
        }

        private requestRefresh(start: number, immediate: boolean): void {
            if (this.disposed) {
                return;
            }
            const boundedStart = Math.max(
                0,
                Math.min(this.view.state.doc.length, Math.floor(start)),
            );
            this.pendingStart = this.pendingStart === null ? boundedStart :
                Math.min(this.pendingStart, boundedStart);
            this.pendingImmediate ||= immediate;
            this.generation += 1;

            if (this.timer !== null) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            if (!this.running && immediate) {
                this.startPendingRefresh();
                return;
            }
            if (!this.running) {
                this.timer = setTimeout(() => {
                    this.timer = null;
                    this.startPendingRefresh();
                }, embeddedRefreshDebounceMs);
            }
        }

        private startPendingRefresh(): void {
            if (this.disposed || this.running || this.pendingStart === null) {
                return;
            }
            const start = this.pendingStart;
            const generation = this.generation;
            this.pendingStart = null;
            this.pendingImmediate = false;
            this.running = true;
            void this.refresh(start, generation).finally(() => {
                this.running = false;
                if (this.disposed || this.pendingStart === null) {
                    return;
                }
                if (this.pendingImmediate) {
                    this.startPendingRefresh();
                    return;
                }
                this.timer = setTimeout(() => {
                    this.timer = null;
                    this.startPendingRefresh();
                }, embeddedRefreshDebounceMs);
            });
        }

        private async refresh(start: number, generation: number): Promise<void> {
            // ViewPlugin construction can happen inside EditorView.update().
            // Always yield before dispatching decorations, including the
            // empty-document and all-cache-hit cases.
            await Promise.resolve();
            const source = this.view.state.doc.toString();
            const prefix = start > 0 ? this.indexedBlocks.filter((indexed) => (
                indexed.after <= start && indexed.after <= source.length
            )) : [];
            const suffix = scanIndexedEmbeddedCodeBlocks(source, start);
            const indexedBlocks = [...prefix, ...suffix];
            const blocks: EmbeddedBlockHighlight[] = [];

            for (const indexed of indexedBlocks) {
                if (this.disposed || generation !== this.generation) {
                    return;
                }
                const block = indexed.block;
                const key = cacheKey(source, block);
                let cached = this.cache.get(key);
                if (cached) {
                    this.cache.delete(key);
                    this.cache.set(key, cached);
                } else {
                    const loaded = await registry.load(block.lang);
                    if (this.disposed || generation !== this.generation) {
                        return;
                    }
                    const body = source.slice(block.from, block.to);
                    cached = {
                        alias: block.lang,
                        result: loaded,
                        spans: highlightBlockBody(body, 0, loaded),
                    };
                    this.cache.set(key, cached);
                    while (this.cache.size > maxCachedEmbeddedBlocks) {
                        const oldest = this.cache.keys().next();
                        if (oldest.done) {
                            break;
                        }
                        this.cache.delete(oldest.value);
                    }
                }
                blocks.push(withAbsoluteSpans(block, cached));
            }

            if (
                this.disposed ||
                generation !== this.generation ||
                source !== this.view.state.doc.toString()
            ) {
                return;
            }
            this.indexedBlocks = indexedBlocks;
            this.view.dispatch({effects: setDecorations.of(decorationsFor(blocks))});
        }
    });

    return [decorations, plugin];
}

export interface StaticCodeHighlightingOptions {
    readonly enabled?: boolean;
    readonly selector?: string;
}

export interface StaticCodeHighlightingResult {
    readonly blocks: number;
    readonly highlighted: number;
    readonly fallback: number;
}

export interface StaticCodeHighlighter {
    refresh(): Promise<StaticCodeHighlightingResult>;
    destroy(): void;
}

const staticHighlightMarker = "data-codemirror6-static-highlight";
const safeClassName = /^[^\s"'<>]+$/;

function staticCodeElements(
    root: ParentNode,
    selector: string,
): HTMLElement[] {
    const elements = Array.from(root.querySelectorAll(selector));
    if (
        typeof Element !== "undefined" &&
        root instanceof Element &&
        root.matches(selector)
    ) {
        elements.unshift(root);
    }
    return elements.filter((element): element is HTMLElement => (
        typeof HTMLElement === "undefined" || element instanceof HTMLElement
    ));
}

function plainText(element: HTMLElement, source: string): void {
    element.replaceChildren(element.ownerDocument.createTextNode(source));
    element.classList.add("cm-s-default");
    element.setAttribute(staticHighlightMarker, "plain");
}

function renderStaticSpans(
    element: HTMLElement,
    source: string,
    spans: readonly EmbeddedHighlightSpan[],
): void {
    const document = element.ownerDocument;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    const ordered = [...spans].sort((left, right) => (
        left.from - right.from || left.to - right.to
    ));

    for (const span of ordered) {
        const from = Math.max(cursor, Math.min(source.length, span.from));
        const to = Math.max(from, Math.min(source.length, span.to));
        if (to <= from) {
            continue;
        }
        if (from > cursor) {
            fragment.append(document.createTextNode(source.slice(cursor, from)));
        }

        const classes = span.classes.split(/\s+/).filter((name) => (
            safeClassName.test(name)
        ));
        if (classes.length) {
            const token = document.createElement("span");
            token.classList.add(...classes);
            token.textContent = source.slice(from, to);
            fragment.append(token);
        } else {
            fragment.append(document.createTextNode(source.slice(from, to)));
        }
        cursor = to;
    }

    if (cursor < source.length) {
        fragment.append(document.createTextNode(source.slice(cursor)));
    }
    element.replaceChildren(fragment);
    element.classList.add("cm-s-default");
    element.setAttribute(staticHighlightMarker, "highlighted");
}

function languageForStaticElement(
    element: HTMLElement,
    registry: EmbeddedLanguageRegistry,
): string | null {
    for (const className of Array.from(element.classList)) {
        if (registry.lookup(className)) {
            return className;
        }
    }
    return null;
}

/** Highlights rendered DokuWiki code without creating an EditorView per block. */
export async function highlightStaticCodeBlocks(
    root: ParentNode,
    registry: EmbeddedLanguageRegistry,
    options: StaticCodeHighlightingOptions = {},
): Promise<StaticCodeHighlightingResult> {
    if (options.enabled === false) {
        return {blocks: 0, highlighted: 0, fallback: 0};
    }

    const selector = options.selector ?? "#dokuwiki__content pre.code";
    const elements = staticCodeElements(root, selector);
    const candidates = elements.map((element) => {
        const source = element.textContent ?? "";
        const lang = languageForStaticElement(element, registry);
        plainText(element, source);
        return {element, lang, source};
    });

    let highlighted = 0;
    let fallback = 0;
    await Promise.all(candidates.map(async (candidate) => {
        if (!candidate.lang) {
            fallback += 1;
            return;
        }
        try {
            const block: EmbeddedCodeBlock = {
                closed: true,
                filename: null,
                from: 0,
                kind: "code",
                lang: candidate.lang,
                to: candidate.source.length,
            };
            const loaded = await highlightEmbeddedBlock(
                candidate.source,
                block,
                registry,
            );
            if (loaded.result.status !== "loaded" ||
                candidate.element.textContent !== candidate.source) {
                fallback += 1;
                return;
            }
            renderStaticSpans(candidate.element, candidate.source, loaded.spans);
            highlighted += 1;
        } catch (_error) {
            fallback += 1;
        }
    }));

    return {blocks: elements.length, highlighted, fallback};
}

export function createStaticCodeHighlighter(
    root: ParentNode,
    registry: EmbeddedLanguageRegistry,
    options: StaticCodeHighlightingOptions = {},
): StaticCodeHighlighter {
    let destroyed = false;
    return {
        refresh(): Promise<StaticCodeHighlightingResult> {
            if (destroyed) {
                return Promise.resolve({blocks: 0, highlighted: 0, fallback: 0});
            }
            return highlightStaticCodeBlocks(root, registry, options);
        },
        destroy(): void {
            destroyed = true;
        },
    };
}
