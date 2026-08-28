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
import * as apl from "@codemirror/legacy-modes/mode/apl";
import * as asciiarmor from "@codemirror/legacy-modes/mode/asciiarmor";
import * as asn1 from "@codemirror/legacy-modes/mode/asn1";
import * as asterisk from "@codemirror/legacy-modes/mode/asterisk";
import * as brainfuck from "@codemirror/legacy-modes/mode/brainfuck";
import * as clike from "@codemirror/legacy-modes/mode/clike";
import * as clojure from "@codemirror/legacy-modes/mode/clojure";
import * as cmake from "@codemirror/legacy-modes/mode/cmake";
import * as cobol from "@codemirror/legacy-modes/mode/cobol";
import * as coffeescript from "@codemirror/legacy-modes/mode/coffeescript";
import * as commonlisp from "@codemirror/legacy-modes/mode/commonlisp";
import * as crystal from "@codemirror/legacy-modes/mode/crystal";
import * as css from "@codemirror/legacy-modes/mode/css";
import * as cypher from "@codemirror/legacy-modes/mode/cypher";
import * as d from "@codemirror/legacy-modes/mode/d";
import * as diff from "@codemirror/legacy-modes/mode/diff";
import * as dockerfile from "@codemirror/legacy-modes/mode/dockerfile";
import * as dtd from "@codemirror/legacy-modes/mode/dtd";
import * as dylan from "@codemirror/legacy-modes/mode/dylan";
import * as ebnf from "@codemirror/legacy-modes/mode/ebnf";
import * as ecl from "@codemirror/legacy-modes/mode/ecl";
import * as eiffel from "@codemirror/legacy-modes/mode/eiffel";
import * as elm from "@codemirror/legacy-modes/mode/elm";
import * as erlang from "@codemirror/legacy-modes/mode/erlang";
import * as factor from "@codemirror/legacy-modes/mode/factor";
import * as fcl from "@codemirror/legacy-modes/mode/fcl";
import * as forth from "@codemirror/legacy-modes/mode/forth";
import * as fortran from "@codemirror/legacy-modes/mode/fortran";
import * as gherkin from "@codemirror/legacy-modes/mode/gherkin";
import * as go from "@codemirror/legacy-modes/mode/go";
import * as groovy from "@codemirror/legacy-modes/mode/groovy";
import * as haskell from "@codemirror/legacy-modes/mode/haskell";
import * as haxe from "@codemirror/legacy-modes/mode/haxe";
import * as http from "@codemirror/legacy-modes/mode/http";
import * as idl from "@codemirror/legacy-modes/mode/idl";
import * as javascript from "@codemirror/legacy-modes/mode/javascript";
import * as jinja2 from "@codemirror/legacy-modes/mode/jinja2";
import * as julia from "@codemirror/legacy-modes/mode/julia";
import * as livescript from "@codemirror/legacy-modes/mode/livescript";
import * as lua from "@codemirror/legacy-modes/mode/lua";
import * as mbox from "@codemirror/legacy-modes/mode/mbox";
import * as mllike from "@codemirror/legacy-modes/mode/mllike";
import * as modelica from "@codemirror/legacy-modes/mode/modelica";
import * as mscgen from "@codemirror/legacy-modes/mode/mscgen";
import * as mumps from "@codemirror/legacy-modes/mode/mumps";
import * as nginx from "@codemirror/legacy-modes/mode/nginx";
import * as nsis from "@codemirror/legacy-modes/mode/nsis";
import * as ntriples from "@codemirror/legacy-modes/mode/ntriples";
import * as octave from "@codemirror/legacy-modes/mode/octave";
import * as oz from "@codemirror/legacy-modes/mode/oz";
import * as pascal from "@codemirror/legacy-modes/mode/pascal";
import * as pegjs from "@codemirror/legacy-modes/mode/pegjs";
import * as perl from "@codemirror/legacy-modes/mode/perl";
import * as pig from "@codemirror/legacy-modes/mode/pig";
import * as powershell from "@codemirror/legacy-modes/mode/powershell";
import * as properties from "@codemirror/legacy-modes/mode/properties";
import * as protobuf from "@codemirror/legacy-modes/mode/protobuf";
import * as pug from "@codemirror/legacy-modes/mode/pug";
import * as puppet from "@codemirror/legacy-modes/mode/puppet";
import * as python from "@codemirror/legacy-modes/mode/python";
import * as q from "@codemirror/legacy-modes/mode/q";
import * as r from "@codemirror/legacy-modes/mode/r";
import * as rpm from "@codemirror/legacy-modes/mode/rpm";
import * as ruby from "@codemirror/legacy-modes/mode/ruby";
import * as rust from "@codemirror/legacy-modes/mode/rust";
import * as sas from "@codemirror/legacy-modes/mode/sas";
import * as sass from "@codemirror/legacy-modes/mode/sass";
import * as scheme from "@codemirror/legacy-modes/mode/scheme";
import * as sieve from "@codemirror/legacy-modes/mode/sieve";
import * as shell from "@codemirror/legacy-modes/mode/shell";
import * as smalltalk from "@codemirror/legacy-modes/mode/smalltalk";
import * as solr from "@codemirror/legacy-modes/mode/solr";
import * as sparql from "@codemirror/legacy-modes/mode/sparql";
import * as spreadsheet from "@codemirror/legacy-modes/mode/spreadsheet";
import * as sql from "@codemirror/legacy-modes/mode/sql";
import * as stex from "@codemirror/legacy-modes/mode/stex";
import * as stylus from "@codemirror/legacy-modes/mode/stylus";
import * as swift from "@codemirror/legacy-modes/mode/swift";
import * as tcl from "@codemirror/legacy-modes/mode/tcl";
import * as textile from "@codemirror/legacy-modes/mode/textile";
import * as tiddlywiki from "@codemirror/legacy-modes/mode/tiddlywiki";
import * as tiki from "@codemirror/legacy-modes/mode/tiki";
import * as toml from "@codemirror/legacy-modes/mode/toml";
import * as troff from "@codemirror/legacy-modes/mode/troff";
import * as ttcn from "@codemirror/legacy-modes/mode/ttcn";
import * as ttcnCfg from "@codemirror/legacy-modes/mode/ttcn-cfg";
import * as turtle from "@codemirror/legacy-modes/mode/turtle";
import * as vb from "@codemirror/legacy-modes/mode/vb";
import * as vbscript from "@codemirror/legacy-modes/mode/vbscript";
import * as velocity from "@codemirror/legacy-modes/mode/velocity";
import * as verilog from "@codemirror/legacy-modes/mode/verilog";
import * as vhdl from "@codemirror/legacy-modes/mode/vhdl";
import * as webidl from "@codemirror/legacy-modes/mode/webidl";
import * as xml from "@codemirror/legacy-modes/mode/xml";
import * as xquery from "@codemirror/legacy-modes/mode/xquery";
import * as yacas from "@codemirror/legacy-modes/mode/yacas";
import * as yaml from "@codemirror/legacy-modes/mode/yaml";
import * as z80 from "@codemirror/legacy-modes/mode/z80";

import type {StringStream} from "@codemirror/language";
import type {EmbeddedMode} from "../../dokuwiki/token-types";
import type {EmbeddedProviderModule} from "../provider-types";

interface HtmlMixedTag {
    name: "script" | "style";
    text: string;
}

interface HtmlMixedState {
    htmlState: unknown;
    localMode: EmbeddedMode | null;
    localState: unknown;
    localTag: "script" | "style" | null;
    pendingTag: HtmlMixedTag | null;
}

const modes = {
    apl: apl.apl,
    asciiArmor: asciiarmor.asciiArmor,
    asn1: asn1.asn1,
    asterisk: asterisk.asterisk,
    shell: shell.shell,
    brainfuck: brainfuck.brainfuck,
    c: clike.c,
    cpp: clike.cpp,
    cassandra: sql.cassandra,
    ceylon: clike.ceylon,
    clojure: clojure.clojure,
    cmake: cmake.cmake,
    cobol: cobol.cobol,
    coffeeScript: coffeescript.coffeeScript,
    crystal: crystal.crystal,
    csharp: clike.csharp,
    css: css.css,
    cypher: cypher.cypher,
    cython: python.cython,
    diff: diff.diff,
    d: d.d,
    dart: clike.dart,
    dockerFile: dockerfile.dockerFile,
    dtd: dtd.dtd,
    dylan: dylan.dylan,
    ebnf: ebnf.ebnf,
    ecl: ecl.ecl,
    javascript: javascript.javascript,
    jinja2: jinja2.jinja2,
    elm: elm.elm,
    eiffel: eiffel.eiffel,
    erlang: erlang.erlang,
    factor: factor.factor,
    fcl: fcl.fcl,
    forth: forth.forth,
    fortran: fortran.fortran,
    fSharp: mllike.fSharp,
    gherkin: gherkin.gherkin,
    shader: clike.shader,
    go: go.go,
    groovy: groovy.groovy,
    gql: sql.gql,
    gss: css.gss,
    hive: sql.hive,
    haskell: haskell.haskell,
    haxe: haxe.haxe,
    hxml: haxe.hxml,
    html: createHtmlMixedMode(),
    http: http.http,
    idl: idl.idl,
    properties: properties.properties,
    pug: pug.pug,
    java: clike.java,
    julia: julia.julia,
    json: javascript.json,
    jsonld: javascript.jsonld,
    kotlin: clike.kotlin,
    stex: stex.stex,
    stexMath: stex.stexMath,
    less: css.less,
    commonLisp: commonlisp.commonLisp,
    liveScript: livescript.liveScript,
    lua: lua.lua,
    mariaDB: sql.mariaDB,
    octave: octave.octave,
    mbox: mbox.mbox,
    modelica: modelica.modelica,
    mscgen: mscgen.mscgen,
    msgenny: mscgen.msgenny,
    msSQL: sql.msSQL,
    mySQL: sql.mySQL,
    mumps: mumps.mumps,
    nginx: nginx.nginx,
    nsis: nsis.nsis,
    ntriples: ntriples.ntriples,
    objectiveC: clike.objectiveC,
    oCaml: mllike.oCaml,
    oz: oz.oz,
    pascal: pascal.pascal,
    pegjs: pegjs.pegjs,
    perl: perl.perl,
    pgSQL: sql.pgSQL,
    pig: pig.pig,
    plSQL: sql.plSQL,
    powerShell: powershell.powerShell,
    protobuf: protobuf.protobuf,
    python: python.python,
    puppet: puppet.puppet,
    q: q.q,
    r: r.r,
    rpmChanges: rpm.rpmChanges,
    rpmSpec: rpm.rpmSpec,
    ruby: ruby.ruby,
    rust: rust.rust,
    sas: sas.sas,
    sass: sass.sass,
    scala: clike.scala,
    scheme: scheme.scheme,
    sCSS: css.sCSS,
    sieve: sieve.sieve,
    smalltalk: smalltalk.smalltalk,
    solr: solr.solr,
    sparql: sparql.sparql,
    spreadsheet: spreadsheet.spreadsheet,
    standardSQL: sql.standardSQL,
    squirrel: clike.squirrel,
    stylus: stylus.stylus,
    swift: swift.swift,
    tcl: tcl.tcl,
    textile: textile.textile,
    tiddlyWiki: tiddlywiki.tiddlyWiki,
    tiki: tiki.tiki,
    toml: toml.toml,
    troff: troff.troff,
    ttcn: ttcn.ttcn,
    ttcnCfg: ttcnCfg.ttcnCfg,
    turtle: turtle.turtle,
    typescript: javascript.typescript,
    vb: vb.vb,
    vbScript: vbscript.vbScript,
    velocity: velocity.velocity,
    verilog: verilog.verilog,
    vhdl: vhdl.vhdl,
    webIDL: webidl.webIDL,
    xml: xml.xml,
    xQuery: xquery.xQuery,
    xu: mscgen.xu,
    yacas: yacas.yacas,
    yaml: yaml.yaml,
    z80: z80.z80,
} as unknown as Readonly<Record<string, EmbeddedMode>>;

const bridgedStream = Symbol("legacy-stream-bridge");

type LegacyMatch = string | RegExp | ((character: string) => boolean);
type LegacyStream = StringStream & {
    [bridgedStream]?: boolean;
    eat: (match: LegacyMatch) => string | void;
};

function bridgeStream(stream: StringStream): void {
    const legacy = stream as LegacyStream;
    if (legacy[bridgedStream]) {
        return;
    }
    const originalEat = legacy.eat.bind(stream);
    legacy.eat = (match: LegacyMatch) => {
        if (
            typeof match === "object" &&
            Object.prototype.toString.call(match) === "[object RegExp]"
        ) {
            const crossRealmRegExp = match as RegExp;
            return originalEat((character) => crossRealmRegExp.test(character));
        }
        return originalEat(match);
    };
    legacy[bridgedStream] = true;
}

function adaptMode(mode: EmbeddedMode): EmbeddedMode {
    return {
        ...mode,
        token(stream, state) {
            bridgeStream(stream);
            return mode.token(stream, state);
        },
    };
}

const plainHtmlMixedMode: EmbeddedMode = {
    startState: () => ({}),
    token(stream) {
        stream.skipToEnd();
        return null;
    },
};

function htmlAttributeValue(tagText: string, name: string): string | null {
    const attribute = new RegExp(
        `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
        "i",
    ).exec(tagText);
    return attribute ? attribute[1] ?? attribute[2] ?? attribute[3] ?? "" : null;
}

function htmlLocalMode(
    tag: HtmlMixedTag,
    javascriptMode: EmbeddedMode,
    cssMode: EmbeddedMode,
): EmbeddedMode {
    const lang = htmlAttributeValue(tag.text, "lang");
    const type = htmlAttributeValue(tag.text, "type");
    if (tag.name === "script") {
        if (lang !== null) {
            return /^(?:javascript|babel)$/i.test(lang) ? javascriptMode : plainHtmlMixedMode;
        }
        return type === null || /^(?:text|application)\/(?:x-)?(?:java|ecma)script$|^module$/i.test(type)
            ? javascriptMode
            : plainHtmlMixedMode;
    }
    if (lang !== null) {
        return /^css$/i.test(lang) ? cssMode : plainHtmlMixedMode;
    }
    return type === null || /^(?:text\/)?(?:x-)?(?:stylesheet|css)$/i.test(type)
        ? cssMode
        : plainHtmlMixedMode;
}

function closingTag(name: "script" | "style", anchored: boolean): RegExp {
    return new RegExp(
        `${anchored ? "^" : ""}<\\/\\s*${name}\\s*>`,
        "i",
    );
}

function backUpClosingTag(
    stream: StringStream,
    pattern: RegExp,
    style: string | null | undefined,
): string | null | undefined {
    const current = stream.current();
    const close = current.search(pattern);
    if (close > -1) {
        stream.backUp(current.length - close);
    } else if (/^<\/?$/.test(current)) {
        stream.backUp(current.length);
        if (!stream.match(pattern, false)) {
            stream.match(current);
        }
    }
    return style;
}

function copyModeState(mode: EmbeddedMode, state: unknown): unknown {
    return mode.copyState ? mode.copyState(state) : state;
}

function createHtmlMixedMode(): EmbeddedMode {
    const htmlMode = adaptMode(xml.html as unknown as EmbeddedMode);
    const javascriptMode = adaptMode(javascript.javascript as unknown as EmbeddedMode);
    const cssMode = adaptMode(css.css as unknown as EmbeddedMode);

    const token = (stream: StringStream, value: unknown): string | null => {
        const state = value as HtmlMixedState;
        if (state.localMode && state.localTag) {
            const endTag = closingTag(state.localTag, true);
            if (stream.match(endTag, false)) {
                state.localMode = null;
                state.localState = null;
                state.localTag = null;
                return htmlMode.token(stream, state.htmlState) ?? null;
            }

            const style = state.localMode.token(stream, state.localState);
            return backUpClosingTag(
                stream,
                closingTag(state.localTag, false),
                style,
            ) ?? null;
        }

        const style = htmlMode.token(stream, state.htmlState);
        const current = stream.current();
        const htmlState = state.htmlState as {tagName?: unknown};
        const tagName = typeof htmlState.tagName === "string"
            ? htmlState.tagName.toLowerCase()
            : null;

        if (
            !state.pendingTag &&
            style === "tag" &&
            (tagName === "script" || tagName === "style") &&
            current.toLowerCase() === tagName
        ) {
            state.pendingTag = {name: tagName, text: current};
        } else if (state.pendingTag) {
            state.pendingTag.text += current;
            if (style === "angleBracket" && /\/?>$/.test(current)) {
                const tag = state.pendingTag;
                state.pendingTag = null;
                if (!/\/\s*>$/.test(tag.text)) {
                    state.localTag = tag.name;
                    state.localMode = htmlLocalMode(tag, javascriptMode, cssMode);
                    state.localState = state.localMode.startState?.(4) ?? {};
                }
            }
        }
        return style ?? null;
    };

    return {
        startState(indentUnit = 4): HtmlMixedState {
            return {
                htmlState: htmlMode.startState?.(indentUnit) ?? {},
                localMode: null,
                localState: null,
                localTag: null,
                pendingTag: null,
            };
        },
        copyState(value): HtmlMixedState {
            const state = value as HtmlMixedState;
            return {
                htmlState: copyModeState(htmlMode, state.htmlState),
                localMode: state.localMode,
                localState: state.localMode
                    ? copyModeState(state.localMode, state.localState)
                    : null,
                localTag: state.localTag,
                pendingTag: state.pendingTag ? {...state.pendingTag} : null,
            };
        },
        token,
        blankLine(state, indentUnit): void {
            const mixedState = state as HtmlMixedState;
            if (mixedState.localMode?.blankLine) {
                mixedState.localMode.blankLine(mixedState.localState, indentUnit);
            } else {
                htmlMode.blankLine?.(mixedState.htmlState, indentUnit);
            }
        },
        indent(state, textAfter, context) {
            const mixedState = state as HtmlMixedState;
            if (!mixedState.localMode || /^\s*<\//.test(textAfter)) {
                return htmlMode.indent?.(mixedState.htmlState, textAfter, context) ?? null;
            }
            return mixedState.localMode.indent?.(
                mixedState.localState,
                textAfter,
                context,
            ) ?? null;
        },
    };
}

export const embeddedProvider: EmbeddedProviderModule = {
    getLegacyMode(providerKey: string): EmbeddedMode | null {
        const mode = modes[providerKey];
        return mode ? adaptMode(mode) : null;
    },
};
