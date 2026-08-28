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
export function escapeRegExp(value: string): string {
    return value.replace(/([.*+?^=!:${}()|[\]\\/])/g, "\\$1");
}

export function wordsRegExp(
    words: readonly string[],
    end = "",
    flags = "",
): RegExp {
    const escapedWords = words.map(escapeRegExp);
    return new RegExp(`^(?:${escapedWords.join("|")})${end}`, flags);
}

export function emailLinkRegExp(): RegExp {
    const text = "[0-9a-zA-Z!#$%&'*+/=?^_`{|}~-]+";
    const email = `${text}(?:\\.${text})*@(?:[0-9a-z][0-9a-z-]*\\.)+` +
        "(?:[a-z]{2,4}|museum|travel)";
    return new RegExp(`^<${email}>`, "i");
}

export function externalLinkRegExp(schemes: readonly string[]): RegExp {
    const punc = ".:?\\-;,";
    const host = `\\w${punc}`;
    const any = `\\w/#~:.?+=&%@!\\-\\[\\]${punc}`;
    const patterns = schemes.map((scheme) =>
        `${scheme}://[${any}]+?(?=[${punc}]*[^${any}]|$)`);
    patterns.push(
        `www?\\.[${host}]+?\\.[${host}]+?[${any}]+?(?=[${punc}]*[^${any}]|$)`,
    );
    patterns.push(
        `ftp?\\.[${host}]+?\\.[${host}]+?[${any}]+?(?=[${punc}]*[^${any}]|$)`,
    );
    return new RegExp(`^(?:${patterns.join("|")})`, "i");
}

export function fileLinkRegExp(): RegExp {
    const punc = ".:?\\-;,";
    const any = `\\w/#~:.?+=&%@!\\-\\[\\]${punc}`;
    return new RegExp(
        `^file://[${any}]+?(?=[${punc}]*[^${any}]|$)`,
        "i",
    );
}
