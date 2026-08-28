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
export type EmbeddedProviderKind = "fallback" | "legacy" | "native";

export interface EmbeddedLanguageSpec {
    readonly key: string;
    readonly name: string;
    readonly mime?: string;
    readonly deps: readonly string[];
    readonly options?: Readonly<Record<string, unknown>>;
    readonly provider: EmbeddedProviderKind;
    readonly providerKey?: string;
    readonly asset?: string;
}

function fallback(
    key: string,
    name: string,
    mime?: string,
    deps: readonly string[] = [],
    options?: Readonly<Record<string, unknown>>,
): EmbeddedLanguageSpec {
    return {key, name, mime, deps, options, provider: "fallback"};
}

function legacy(
    key: string,
    name: string,
    mime: string | undefined = undefined,
    providerKey: string = name,
    deps: readonly string[] = [],
    options?: Readonly<Record<string, unknown>>,
): EmbeddedLanguageSpec {
    return {
        key,
        name,
        mime,
        deps,
        options,
        provider: "legacy",
        providerKey,
        asset: "legacy.js",
    };
}

function native(
    key: string,
    name: string,
    mime: string | undefined,
    providerKey: string,
    deps: readonly string[] = [],
    options?: Readonly<Record<string, unknown>>,
): EmbeddedLanguageSpec {
    return {
        key,
        name,
        mime,
        deps,
        options,
        provider: "native",
        providerKey,
        asset: "php.js",
    };
}

/**
 * The exact key set from init.js, kept in source order for reviewability.
 * `name`, `mime`, `deps`, and `options` retain the CM5 codeModes contract;
 * provider fields only describe the CM6 implementation selected for loading.
 */
export const embeddedLanguageSpecs: readonly EmbeddedLanguageSpec[] = Object.freeze([
    legacy("apl", "apl", undefined, "apl"),
    legacy("asciiarmor", "asciiarmor", undefined, "asciiArmor"),
    legacy("asn.1", "asn.1", "text/x-ttcn-asn", "asn1"),
    legacy("asterisk", "asterisk"),
    fallback("aspx", "htmlembedded", "application/x-aspx", ["clike"]),
    legacy("bash", "shell", undefined, "shell"),
    legacy("brainfuck", "brainfuck"),
    legacy("c", "clike", "text/x-csrc", "c"),
    legacy("cassandra", "sql", "text/x-cassandra", "cassandra"),
    legacy("ceylon", "clike", "text/x-ceylon", "ceylon"),
    legacy("clojure", "clojure"),
    legacy("cmake", "cmake"),
    legacy("cobol", "cobol"),
    legacy("coffeescript", "coffeescript", undefined, "coffeeScript"),
    legacy("cpp", "clike", "text/x-c++src", "cpp"),
    legacy("crystal", "crystal"),
    legacy("csharp", "clike", "text/x-csharp", "csharp"),
    legacy("css", "css", "text/css", "css"),
    legacy("cypher", "cypher"),
    legacy("cython", "python", "text/x-cython", "cython"),
    legacy("diff", "diff"),
    legacy("d", "d", "text/x-d", "d"),
    legacy("dart", "dart", undefined, "dart"),
    fallback("django", "django", undefined, ["htmlmixed"]),
    legacy("dockerfile", "dockerfile", undefined, "dockerFile"),
    legacy("dtd", "dtd"),
    legacy("dylan", "dylan"),
    legacy("ebnf", "ebnf"),
    legacy("ecl", "ecl"),
    legacy("ecmascript", "javascript", "application/ecmascript", "javascript"),
    legacy("elm", "elm"),
    fallback("erb", "htmlembedded", "application/x-erb", ["ruby"]),
    legacy("eiffel", "eiffel"),
    fallback("ejs", "htmlembedded", "application/x-ejs", ["javascript"]),
    legacy("erlang", "erlang"),
    legacy("factor", "factor"),
    legacy("fcl", "fcl"),
    legacy("forth", "forth"),
    legacy("fortran", "fortran"),
    legacy("fsharp", "mllike", "text/x-fsharp", "fSharp"),
    fallback("gfm", "gfm"),
    legacy("gherkin", "gherkin"),
    legacy("glsl", "clike", "x-shader/x-vertex", "shader"),
    legacy("go", "go"),
    legacy("gql", "sql", "text/x-gql", "gql"),
    legacy("groovy", "groovy"),
    legacy("gss", "css", "text/x-gss", "gss"),
    fallback("haml", "haml"),
    fallback("handlebars", "handlebars"),
    legacy("haskell", "haskell"),
    fallback("haskell-literate", "haskell-literate"),
    legacy("haxe", "haxe", "text/x-haxe", "haxe"),
    legacy("hive", "sql", "text/x-hive", "hive"),
    legacy("html", "htmlmixed", undefined, "html"),
    legacy("html5", "htmlmixed", undefined, "html"),
    legacy("http", "http"),
    legacy("hxml", "haxe", "text/x-hxml", "hxml"),
    legacy("idl", "idl"),
    legacy("ini", "properties", undefined, "properties"),
    legacy("jade", "pug", undefined, "pug", ["javascript"]),
    legacy("java5", "clike", "text/x-java", "java"),
    legacy("java", "clike", "text/x-java", "java"),
    legacy("javascript", "javascript", "application/javascript", "javascript"),
    legacy("jinja2", "jinja2"),
    legacy("json", "javascript", "application/json", "json"),
    legacy("jsonld", "javascript", "application/ld+json", "jsonld"),
    fallback("jsp", "htmlembedded", "application/x-jsp", ["clike"]),
    legacy("jsx", "javascript", undefined, "javascript"),
    legacy("julia", "julia"),
    legacy("kotlin", "clike", "text/x-kotlin", "kotlin"),
    legacy("latex", "stex", undefined, "stexMath"),
    legacy("less", "css", "text/x-less", "less"),
    legacy("lisp", "commonlisp", undefined, "commonLisp"),
    legacy("livescript", "livescript", undefined, "liveScript"),
    legacy("lua", "lua"),
    legacy("mariadb", "sql", "text/x-mariadb", "mariaDB"),
    fallback("markdown", "markdown"),
    legacy("matlab", "octave", undefined, "octave"),
    legacy("mbox", "mbox"),
    legacy("modelica", "modelica", "text/x-modelica", "modelica"),
    legacy("mscgen", "mscgen", undefined, "mscgen"),
    legacy("mscgenny", "mscgen", "text/x-msgenny", "msgenny"),
    legacy("mssql", "sql", "text/x-mssql", "msSQL"),
    legacy("mumps", "mumps"),
    legacy("mysql", "sql", "text/x-sql", "mySQL"),
    legacy("nginx", "nginx"),
    legacy("nsis", "nsis"),
    legacy("ntriples", "ntriples"),
    legacy("objc", "clike", "text/x-objectivec", "objectiveC"),
    legacy("ocaml", "mllike", "text/x-ocaml", "oCaml"),
    legacy("octave", "octave"),
    legacy("oz", "oz"),
    legacy("pascal", "pascal"),
    legacy("pgp", "asciiarmor", undefined, "asciiArmor"),
    legacy("pegjs", "pegjs"),
    legacy("perl", "perl"),
    legacy("pgsql", "sql", "text/x-pgsql", "pgSQL"),
    native("php", "php", "application/x-httpd-php-open", "php", ["htmlmixed"]),
    legacy("pig", "pig", "text/x-pig", "pig"),
    legacy("plsql", "sql", "text/x-plsql", "plSQL"),
    legacy("postgresql", "sql", "text/x-pgsql", "pgSQL"),
    legacy("powershell", "powershell", undefined, "powerShell"),
    legacy("properties", "properties"),
    legacy("protobuf", "protobuf"),
    legacy("python", "python", "text/x-python", "python"),
    legacy("pug", "pug", undefined, "pug", ["javascript"]),
    legacy("puppet", "puppet"),
    legacy("q", "q"),
    legacy("r", "r"),
    legacy("rpmchanges", "rpm", "text/x-rpm-changes", "rpmChanges"),
    legacy("rpmspec", "rpm", "text/x-rpm-spec", "rpmSpec"),
    fallback("rst", "rst"),
    legacy("ruby", "ruby"),
    legacy("rust", "rust"),
    legacy("sas", "sas"),
    legacy("sass", "sass"),
    legacy("scala", "clike", "text/x-scala", "scala"),
    legacy("scheme", "scheme"),
    legacy("scss", "css", "text/x-scss", "sCSS"),
    legacy("sieve", "sieve"),
    fallback("slim", "slim"),
    legacy("smalltalk", "smalltalk"),
    fallback("smarty", "smarty", undefined, [], {version: 2}),
    fallback("smarty3", "smarty", undefined, [], {version: 3}),
    legacy("solr", "solr"),
    fallback("soy", "soy"),
    legacy("sparql", "sparql"),
    legacy("spreadsheet", "spreadsheet"),
    legacy("sql", "sql", "text/x-sql", "standardSQL"),
    legacy("squirrel", "clike", "text/x-squirrel", "squirrel"),
    legacy("stylus", "stylus"),
    legacy("swift", "swift"),
    legacy("tcl", "tcl"),
    fallback("text", "doku-null"),
    legacy("textile", "textile"),
    legacy("tiddlywiki", "tiddlywiki", undefined, "tiddlyWiki"),
    legacy("tiki", "tiki"),
    legacy("toml", "toml"),
    fallback("tornado", "tornado", undefined, ["htmlmixed"]),
    legacy("troff", "troff"),
    legacy("ttcn", "ttcn", "text/x-ttcn", "ttcn"),
    legacy("ttcn-cfg", "ttcn-cfg", "text/x-ttcn-cfg", "ttcnCfg"),
    legacy("turtle", "turtle"),
    fallback("twig", "twig"),
    legacy("typescript", "javascript", "application/typescript", "typescript"),
    legacy("vbnet", "vb", undefined, "vb"),
    legacy("vbscript", "vbscript", undefined, "vbScript"),
    legacy("velocity", "velocity"),
    legacy("verilog", "verilog", undefined, "verilog"),
    legacy("vhdl", "vhdl"),
    fallback("vue", "vue"),
    legacy("webidl", "webidl", undefined, "webIDL"),
    legacy("xml", "xml", undefined, "xml"),
    legacy("xquery", "xquery", undefined, "xQuery"),
    legacy("xu", "mscgen", "text/x-xu", "xu"),
    legacy("yacas", "yacas"),
    legacy("yaml", "yaml"),
    fallback("yaml-frontmatter", "yaml-frontmatter", undefined, ["gfm"]),
    legacy("z80", "z80"),
]);

const specsByKey: Readonly<Record<string, EmbeddedLanguageSpec>> = Object.freeze(
    Object.fromEntries(embeddedLanguageSpecs.map((spec) => [spec.key, spec])),
);

export const embeddedLanguageKeys: readonly string[] = Object.freeze(
    embeddedLanguageSpecs.map((spec) => spec.key),
);

export function lookupEmbeddedLanguage(key: string): EmbeddedLanguageSpec | null {
    return specsByKey[key] ?? null;
}
