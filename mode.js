/**
 * CodeMirror plugin for DokuWiki
 *
 * @author Albert Gasset <albertgasset@fsfe.org>
 * @license GNU GPL version 2 or later
 */

/* global CodeMirror */

CodeMirror.defineMode('doku', function(config, parserConfig) {
    'use strict';

    var i;  // iterator

    var syntaxModes = {};

    var dokuModes = [];

    var addSyntaxMode = function(sort, token) {
        if (syntaxModes[sort] === undefined) {
            syntaxModes[sort] = [token];
        } else {
            syntaxModes[sort].push(token);
        }
    };

    var mode = {

        blankLine: function(state) {
            if (state.current.patterns) {
                // Search for exit patterns of empty strings and start of line
                for (var i = 0; i < state.current.patterns.length; i += 1) {
                    var p = state.current.patterns[i];
                    if (p.sol && !p.match && p.exit) {
                        state.exit = true;
                        return;
                    }
                }
            }
            if (state.innerMode && state.innerMode.blankLine) {
                return state.innerMode.blankLine(state.innerState);
            }
        },

        copyState: function(state) {
            return {
                current: state.current,
                exit: state.exit,
                codeFilename: state.codeFilename,
                codeLang: state.codeLang,
                innerMode: state.innerMode,
                innerState: state.innerState ?
                    CodeMirror.copyState(state.innerMode, state.innerState) :
                    null,
                linkParam: state.linkParam,
                linkTitle: state.linkTitle,
                temp: {},
                stack: state.stack.slice(0),
            };
        },

        indent: function(state, textAfter) {
            if (state.innerMode && state.innerMode.indent) {
                return state.innerMode.indent(state.innerState, textAfter);
            }
        },

        innerMode: function(state) {
            return {
                mode: state.innerMode || mode,
                state: state.innerMode ? state.innerState : state,
            };
        },

        startState: function() {
            return {
                codeFilename: false,
                codeLang: null,
                current: dokuModes[0],
                exit: false,
                innerMode: null,
                innerState: null,
                linkParam: null,
                linkTitle: false,
                temp: {},
                stack: [],
            };
        },

        token: function (stream, state) {
            var style;

            if (state.exit) {
                // Previous match was an exit pattern
                exitInnerMode(state);
                state.current = state.stack.pop();
                state.exit = false;
            }

            style = dokuToken(stream, state);

            if (!stream.current() && !state.exit) {
                // No pattern matched
                if (state.innerMode) {
                    style = state.innerMode.token(stream, state.innerState);
                } else {
                    stream.next();
                }
            }

            return style;
        },
    };

    /* Dokuwiki default syntax */
    
    addSyntaxMode(0, {
        name: 'base',
        allowedTypes: ['container', 'baseonly', 'formatting',
                       'substition', 'protected', 'disabled'],
    });

    addSyntaxMode(10, {
        name: 'listblock',
        type: 'container',
        allowedTypes: ['formatting', 'substition', 'disabled', 'protected'],
        entries: [
            {sol: true, match: /^ {2,}[\-\*]/, style: 'def'},
            {sol: true, match: /^\t{1,}[\-\*]/, style: 'def'},
        ],
        patterns: [
            {sol: true, match: /^ {2,}[\-\*]/, style: 'def'},
            {sol: true, match: /^\t{1,}[\-\*]/, style: 'def'},
            {sol: true, exit: true},
        ]
    });

    addSyntaxMode(20, {
        name: 'preformatted',
        type: 'protected',
        entries: [
            {sol: true, match: /^  (?![\*\-])/},
            {sol: true, match: /^\t(?![\*\-])/},
        ],
        patterns: [
            {sol: true, match: '  '},
            {sol: true, match: '\t'},
            {sol: true, exit: true},
        ],
        style: 'string'
    });

    addSyntaxMode(30, {
        name: 'notoc',
        type: 'substition',
        entries: [{match: '~~NOTOC~~', exit: true}],
        style: 'meta'
    });

    addSyntaxMode(40, {
        name: 'nocache',
        type: 'substition',
        entries: [{match: '~~NOCACHE~~', exit: true}],
        style: 'meta'
    });

    addSyntaxMode(50, {
        name: 'header',
        type: 'baseonly',
        entries: [{match: /^[ \t]*={2}.+={2,}[ \t]*$/, exit: true}],
        style: 'header'
    });

    addSyntaxMode(60, {
        name: 'table',
        type: 'container',
        allowedTypes: ['formatting', 'substition', 'disabled', 'protected'],
        entries: [
            {sol: true, match: '^', style: 'def'},
            {sol: true, match: '|', style: 'def'},
        ],
        patterns: [
            {match: '^', style: 'def'},
            {match: '|', style: 'def'},
            {match: /^[\t ]*:::[\t ]*(?=[\|\^])/, style: 'def'},
            {match: /^[\t ]+/},
            {sol: true, exit: true},
        ]
    });

    addSyntaxMode(70, {
        name: 'strong',
        type: 'formatting',
        allowedTypes: ['formatting', 'substition', 'disabled'],
        entries: [{match: '**'}],
        patterns: [{match: '**', exit: true}],
        style: 'strong'
    });

    addSyntaxMode(80, {
        name: 'emphasis',
        type: 'formatting',
        allowedTypes: ['formatting', 'substition', 'disabled'],
        entries: [{match: /^\/\/(?=[^\x00]*[^:])/}],
        patterns: [{match: '//', exit: true}],
        style: 'em'
    });

    addSyntaxMode(90, {
        name: 'underline',
        type: 'formatting',
        allowedTypes: ['formatting', 'substition', 'disabled'],
        entries: [{match: '__'}],
        patterns: [{match: '__', exit: true}],
        style: 'underline'
    });

    addSyntaxMode(100, {
        name: 'monospace',
        type: 'formatting',
        allowedTypes: ['formatting', 'substition', 'disabled'],
        entries: [{match: '\'\''}],
        patterns: [{match: '\'\'', exit: true}],
        style: 'quote'
    });

    addSyntaxMode(110, {
        name: 'subscript',
        type: 'formatting',
        allowedTypes: ['formatting', 'substition', 'disabled'],
        entries: [{match: '<sub>', style: 'tag'}],
        patterns: [{match: '</sub>', exit: true, style: 'tag'}]
    });

    addSyntaxMode(120, {
        name: 'superscript',
        type: 'formatting',
        allowedTypes: ['formatting', 'substition', 'disabled'],
        entries: [{match: '<sup>', style: 'tag'}],
        patterns: [{match: '</sup>',  exit: true, style: 'tag'}]
    });

    addSyntaxMode(130, {
        name: 'deleted',
        type: 'formatting',
        allowedTypes: ['formatting', 'substition', 'disabled'],
        entries: [{match: '<del>', style: 'tag'}],
        patterns: [{match: '</del>', exit: true, style: 'tag'}]
    });

    addSyntaxMode(140, {
        name: 'linebreak', // 140
        type: 'substition',
        entries: [{match: /^\\\\(?:[ \t]|$)/, exit: true}],
        style: 'tag'
    });

    addSyntaxMode(150, {
        name: 'footnote',
        type: 'formatting',
        allowedTypes: ['container', 'formatting', 'substition',
                       'protected', 'disabled'],
        entries: [{match: '((', style: 'tag'}],
        patterns: [{match: '))', exit: true, style: 'tag'}]
    });

    addSyntaxMode(160, {
        name: 'hr',
        type: 'container',
        entries: [{sol: true, match: /^[ \t]*-{4,}[ \t]*$/, exit: true}],
        style: 'hr'
    });

    addSyntaxMode(170, {
        name: 'unformatted',
        type: 'disabled',
        entries: [{match: '<nowiki>', style: 'tag'}],
        patterns: [{match: '</nowiki>', exit: true, style: 'tag'}]
    });

    addSyntaxMode(170, {
        name: 'unformattedalt',
        type: 'disabled',
        entries: [{match: '%%'}],
        patterns: [{match: '%%', exit: true}],
        style: 'string'
    });

    addSyntaxMode(180, {
        name: 'php',
        type: 'protected',
        entries: [{match: '<php>', style: 'tag', lang: 'php'}],
        patterns: [{match: '</php>', exit: true, style: 'tag'}]
    });

    addSyntaxMode(180, {
        name: 'phpblock',
        type: 'protected',
        entries: [{match: '<PHP>', style: 'tag', lang: 'php'}],
        patterns: [{match: '</PHP>', exit: true, style: 'tag'}]
    });

    addSyntaxMode(190, {
        name: 'html',
        type: 'protected',
        entries: [{match: '<html>', style: 'tag', lang: 'html'}],
        patterns: [{match: '</html>', exit: true, style: 'tag'}]
    });

    addSyntaxMode(190, {
        name: 'htmlblock',
        type: 'protected',
        entries: [{match: '<HTML>', style: 'tag', lang: 'html'}],
        patterns: [{match: '</HTML>', exit: true, style: 'tag'}]
    });

    addSyntaxMode(200, {
        name: 'code',
        type: 'protected',
        entries: [{match: /^<code(?=\s|>|$)/, style: 'tag'}],
        patterns: [{match: '</code>', exit: true, style: 'tag'}],
        token: codeToken,
    });

    addSyntaxMode(210, {
        name: 'file',
        type: 'protected',
        entries: [{match: /^<file(?=\s|>|$)/, style: 'tag'}],
        patterns: [{match: '</file>', exit: true, style: 'tag'}],
        token: codeToken
    });

    addSyntaxMode(220, {
        name: 'quote',
        type: 'container',
        allowedTypess: ['formatting', 'substition', 'disabled', 'protected'],
        entries: [{sol: true, match: /^>{1,}/, style: 'def'}],
        patterns: [
            {sol: true, match: /^>{1,}/, style: 'def'},
            {sol: true, exit: true},
        ]
    });

    if (parserConfig.smileys.length > 0) {
        addSyntaxMode(230, {
            name: 'smiley',
            type: 'substition',
            entries: [{
                behind: /\B$/,
                match: wordsRegExp(parserConfig.smileys, '(?=\\W|$)'),
                exit: true,
            }],
            style: 'keyword',
        });
    }

    if (parserConfig.acronyms.length > 0) {
        addSyntaxMode(240, {
            name: 'acronym',
            type: 'substition',
            entries: [{
                behind: /\B$/,
                match: wordsRegExp(parserConfig.acronyms, '(?=\\W|$)'),
                exit: true,
            }],
            style: 'keyword',
        });
    }

    if (parserConfig.entities.length > 0) {
        addSyntaxMode(260, {
            name: 'entity',
            type: 'substition',
            entries: [{match: wordsRegExp(parserConfig.entities), exit: true}],
            style: 'keyword',
        });
    }

    addSyntaxMode(270, {
        name: 'multipluentity', // 270
        type: 'substition',
        sort: 270,
        entries: [{behind: /\B$/, match: /^(?:[1-9]|\d{2,})(?=[xX]\d+\b)/}],
        patterns: [
            {match: /^[xX]/, style: 'keyword'},
            {match: /^\d+\b/, exit: true},
        ]
    });

    if (parserConfig.camelcase) {
        addSyntaxMode(290, {
            name: 'camelcaselink',
            type: 'substition',
            entry: [{
                behind: /\B$/,
                match: /^[A-Z]+[a-z]+[A-Z][A-Za-z]*\b/,
                exit: true,
            }],
            style: 'link',
        });
    }

    addSyntaxMode(300, {
        name: 'internallink',
        type: 'substition',
        entries: [{match: '[['}],
        token: function(stream, state) {
            var style;
            if (stream.match(']]')) {
                state.current = state.stack.pop();
                state.linkTitle = false;
            } else if (!state.linkTitle && stream.match('|')) {
                state.linkTitle = true;
            } else {
                stream.next();
                style = state.linkTitle ? 'string' : 'link';
            }
            return tokenStyles(state, style);
        },
    });
    
    addSyntaxMode(310, {
        name: 'rss',
        type: 'substition',
        entries: [{match: /{{rss>/, style: 'tag'}],
        patterns: [{match: '}}', exit: true, style: 'tag'}],
    });

    addSyntaxMode(320, {
        name: 'media',
        type: 'substition',
        entries: [{match: /^\{\{ */}],
        token: function(stream, state) {
            var style;
            if (stream.match(/^ *\}\}/)) {
                state.current = state.stack.pop();
                state.linkParam = false;
                state.linkTitle = false;
            } else if (state.linkTitle) {
                style = 'string';
                stream.next();
            } else if (stream.match(/^\s*\|/)) {
                state.linkTitle = true;
            } else if (state.linkParam) {
                if (stream.match(/^(?:nolink|direct|linkonly)/)) {
                    style = 'keyword';
                } else if (stream.match(/^(?:nocache|recache)/)) {
                    style = 'meta';
                } else if (stream.match(/^\d+(?:[xX]\d+)?/)) {
                    style = 'number';
                } else if (!stream.match(/^\s+/)) {
                    stream.next();
                    style = 'error';
                }
            } else if (stream.match(/^\?(?=[^\?]*$)/)) {
                state.linkParam = true;
            } else {
                stream.next();
                style = 'link';
            }
            return tokenStyles(state, style);
        },
    });
    
    addSyntaxMode(330, {
        name: 'externallink',
        type: 'substition',
        entries: [{
            behind: /\B$/,
            match: externalLinkRegExp(parserConfig.schemes),
            exit: true,
        }],
        style: 'link',
    });
    
    addSyntaxMode(340, {
        name: 'emaillink',
        type: 'substition',
        entries: [{match: emailLinkRegExp(), exit: true}],
        style: 'link',
    });
    
    addSyntaxMode(350, {
        name: 'windowssharelink',
        type: 'substition',
        entries: [{match: /^\\\\\w+?(?:\\[\w-$]+)+/, exit: true}],
        style: 'link',
    });
    
    addSyntaxMode(360, {
        name: 'filelink',
        type: 'substition',
        entries: [{behind: /\B$/, match: fileLinkRegExp(), exit: true}],
        style: 'link',
    });

    /* Plugin pageredirect */

    if (parserConfig.plugins.indexOf('pageredirect') !== -1) {

        addSyntaxMode(1, {
            name: 'redirect_old',
            type: 'substition',
            entries: [{match: /~~REDIRECT>/, style: 'meta'}],
            token: function(stream, state) {
                var style;
                if (stream.match(/^~~/)) {
                    state.current = state.stack.pop();
                    style = 'meta';
                } else {
                    stream.next();
                    style = 'link';
                }
                return tokenStyles(state, style);
            }
        });

        addSyntaxMode(1, {
            name: 'redirect_new',
            type: 'substition',
            entries: [
                {match: /#REDIRECT +/, style: 'meta'},
                {match: /#redirect +/, style: 'meta'}
            ],
            token: function(stream, state) {
                var style;
                if (stream.eol()) {
                    state.current = state.stack.pop();
                } else {
                    stream.next();
                    style = 'link';
                }
                return tokenStyles(state, style);
            }
        });
    
    }

    /* Plugin numberof */

    if (parserConfig.plugins.indexOf('numberof') !== -1) {

        addSyntaxMode(32, {
            name: 'numberof',
            type: 'substition',
            entries: [{
                match: /\{\{NUMBEROF(MEDIAS|PAGES)(>.*?)?\}\}/,
                exit: true, 
                style: 'tag',
            }]
        });

    }

    /* Plugin include */

    if (parserConfig.plugins.indexOf('include') !== -1) {

        addSyntaxMode(50, {
            name: 'include',
            type: 'substition',
            entries: [{
                match: /\{\{(page|section|namespace|tagtopic)>/,
                style: 'tag'
            }],
            token: function(stream, state) {
                var style;
                if (stream.match(/^\}\}/)) {
                    state.current = state.stack.pop();
                    state.temp.is_link = false;
                    style = 'tag';
                } else if (stream.match('&')) {
                    state.temp.is_link = true;
                } else if (state.temp.is_link) {
                    stream.next();
                    style = 'keyword';
                } else {
                    stream.next();
                    style = 'link';
                }
                return tokenStyles(state, style);
            }
        });

    }

    /* Plugin exttab3 */

    if (parserConfig.plugins.indexOf('exttab3') !== -1) {

        addSyntaxMode(59, {
            name: 'exttab3',
            type: 'container',
            allowedTypes: ['container', 'formatting', 'substition',
                        'disabled', 'protected'],
            entries: [{sol: true, match: '{|', style: 'def'}],
            patterns: [
                {match: '|}', exit: true, style: 'def'},
                {match: '|-', style: 'def'},
                {match: '|+', style: 'def'},
                {match: '!!', style: 'def'},
                {match: '!', style: 'def'},
                {match: '||', style: 'def'},
                {match: '|', style: 'def'},
            ]
        });

    }

    /* Plugin bootswrapper */

    if (parserConfig.plugins.indexOf('bootswrapper') !== -1) {

        addSyntaxMode(99, {
            name: 'bootswrapper_macros',
            type: 'substition',
            entries: [{match: /~~(CLEARFIX|PAGEBREAK)~~/, exit: true}],
            style: 'meta'
        });

        var bootswrapperAttrMode = {
            // Dummy mode for attribute parsing.
            name: 'bootswrapper_attr',
            type: 'formatting',
            allowedTypes: ['container', 'formatting', 'baseonly',
                           'substition', 'protected', 'disabled'],
            entries: [{
                match: '',
                style: 'string'
            }],
            token: function(stream, state) {
                var style;
                if (stream.match('>')) {
                    state.current = state.stack.pop();
                    style = 'tag';
                } else if (stream.match(/".+?"/)) {
                    style = 'string';
                } else if (stream.match('=')) {
                    style = 'operator';
                } else {
                    stream.next();
                    style = 'attribute';
                }
                return tokenStyles(state, style);
            }
        };

        var _bootswrapper_tags = [
            'grid', 'panelbody', 'column', 'hidden', 'image', 'invisible',
            'collapse', 'jumbotron', 'carousel', 'label', 'caption', 'lead',
            'panel', 'nav', 'list', 'wrapper', 'pills', 'popover', 'progress',
            'bar', 'row', 'show', 'slide', 'tabs', 'text', 'thumbnail',
            'tooltip', 'well', 'callout', 'modal', 'pane', 'pageheader',
            'accordion', 'affix', 'alert', 'badge', 'button'
        ];

        for (i = 0; i<_bootswrapper_tags.length; i += 1) {
            addSyntaxMode(195, {
                name: 'bootswrapper_' + _bootswrapper_tags[i],
                type: 'formatting',
                allowedTypes: ['container', 'formatting', 'baseonly',
                                'substition', 'protected', 'disabled'],
                entries: [{
                    match: new RegExp(
                        '<' + _bootswrapper_tags[i] + '(?= .+?>|>)'
                    ),
                    style: 'tag',
                    push: bootswrapperAttrMode
                }],
                patterns: [{
                    match: '</' + _bootswrapper_tags[i] + '>',
                    style: 'tag',
                    exit: true
                }]
            });
        }

    }

    /* plugin blockquote */

    if (parserConfig.plugins.indexOf('blockquote') !== -1) {

        addSyntaxMode(123, {
            name: 'blockquote-cite',  // 123
            type: 'formatting',
            allowedTypes: ['container', 'substition', 'protected',
                           'disabled', 'formatting'],
            entries: [{match: '<cite>', style: 'tag'}],
            patterns: [{match: '</cite>', exit: true, style: 'tag'}]
        });

        addSyntaxMode(123, {
            name: 'blockquote-block',  // 123
            type: 'container',
            allowedTypes: ['container', 'substition', 'protected',
                           'disabled', 'formatting'],
            entries: [{match: '<blockquote>', style: 'tag'}],
            patterns: [{match: '</blockquote>', exit: true, style: 'tag'}]
        });

        addSyntaxMode(123, {
            name: 'blockquote-block',  // 123 (duplication to match nested tag)
            type: 'container',
            allowedTypes: ['container', 'substition', 'protected',
                           'disabled', 'formatting'],
            entries: [{match: '<blockquote>', style: 'tag'}],
            patterns: [{match: '</blockquote>', exit: true, style: 'tag'}]
        });

        addSyntaxMode(123, {
            name: 'blockquote-inline',  // 123
            type: 'formatting',
            allowedTypes: ['substition', 'formatting', 'disabled'],
            entries: [{match: '<q>', style: 'tag'}],
            patterns: [{match: '</q>', exit: true, style: 'tag'}]
        });



    }

    /* Plugin refnotes */

    if (parserConfig.plugins.indexOf('refnotes') !== -1) {

        addSyntaxMode(145, {  // Also 150
            name: 'refnote',
            type: 'formatting',
            allowedTypes: ['formatting', 'substition', 'protected',
                           'disabled'],
            entries: [{match: '[(', style: 'tag'}],
            patterns: [{match: ')]', exit: true, style: 'tag'}]
        });

    }

    /* Plugin struct */

    if (parserConfig.plugins.indexOf('struct') !== -1) {

        var _struct_macro = wordsRegExp([
                '%pageid%', '%title%', '%rowid%', '%lastupdate%',
                '%lasteditor%', '%lastsummary%', '$USER$', '$USER.name$',
                '$USER.email$', '$USER.grps$', '$TODAY$', '$ID$', '$PAGE$',
                '$NS$'
            ], '');
        var _struct_table_option = [
                'schema', 'from', 'cols', 'field', 'select', 'head', 'header',
                'headers', 'max', 'limit', 'sort', 'order', 'filter', 'where',
                'filterand', 'and', 'filteror', 'or', 'dynfilters', 'summarize',
                'align', 'rownumbers', 'width', 'widths', 'csv'
            ];
        var _struct_list_option = [
                'schema', 'from', 'cols', 'select', 'head', 'header', 'headers',
                'max', 'limit', 'sort', 'order', 'filter', 'where', 'filterand',
                'and', 'filteror', 'or'
            ];
        var _struct_cloud_option = [
                'schema', 'from', 'tables', 'field', 'select', 'cols', 'col',
                'limit', 'max', 'min', 'page', 'target', 'summarize'
            ];
        var _struct_global_option = [
                'schema', 'from', 'head', 'header',
                'headers', 'max', 'limit', 'sort', 'order', 'filter', 'where',
                'filterand', 'and', 'filteror', 'or', 'dynfilters', 'summarize',
                'align', 'width', 'widths', 'csv'
            ];
        var _struct_serial_option = _struct_global_option;

        var _getStructToken = function(type) {
            var _option;
            if (type === 'table') { _option = _struct_table_option; }
            else if (type === 'list') { _option = _struct_list_option; }
            else if (type === 'cloud') { _option = _struct_cloud_option; }
            else if (type === 'global') { _option = _struct_global_option; }
            else if (type === 'serial') { _option = _struct_serial_option; }
    
            return function(stream, state) {
                var style;
                if (stream.match(/^----/)) {
                    state.current = state.stack.pop();
                    style = 'def';
                } else if (stream.sol() && stream.match(/^.+?(?=:)/)) {
                    if (_option.indexOf(stream.current()) !== -1) {
                        style = 'def';
                    } else {
                        style = 'error';
                    }
                } else if (stream.match(_struct_macro)) {
                    style = 'keyword';
                } else if (stream.match(/^$$STRUCT\.(.+?)\.(.+?)/)) {
                    style = 'keyword';
                } else {
                    stream.next();
                }
                return tokenStyles(state, style);
            };
        };

        addSyntaxMode(151, {
            name: 'struct_cloud',
            type: 'substition',
            entries: [{
                match: /---- *struct *cloud *----/,
                style: 'def'
            }],
            token: _getStructToken('cloud')
        });
        
        addSyntaxMode(155, {
            name: 'struct_table',
            type: 'substition',
            entries: [{
                match: /---- *struct *table *----/,
                style: 'def'
            }],
            token: _getStructToken('table')
        });
        
        addSyntaxMode(155, {
            name: 'struct_list',
            type: 'substition',
            entries: [{
                match: /---- *struct *list *----/,
                style: 'def'
            }],
            token: _getStructToken('list')
        });
        
        addSyntaxMode(155, {
            name: 'struct_global',
            type: 'substition',
            entries: [{
                match: /---- *struct *global *----/,
                style: 'def'
            }],
            token: _getStructToken('global')
        });
        
        addSyntaxMode(155, {
            name: 'struct_serial',
            type: 'substition',
            entries: [{
                match: /---- *struct *serial *----/,
                style: 'def'
            }],
            token: _getStructToken('serial')
        });
        
        addSyntaxMode(315, {
            name: 'struct_value',
            type: 'substition',
            entries: [{match: '{{$', style: 'tag'}],
            patterns: [{match: '}}', exit: true, style: 'tag'}]
        });
    }

    /* Plugin info */

    if (parserConfig.plugins.indexOf('info') !== -1) {

        var _info_keywords = wordsRegExp([
                'syntaxmodes', 'syntaxtypes', 'syntaxplugins', 'adminplugins',
                'actionplugins', 'rendererplugins', 'helperplugins',
                'helpermethods', 'datetime'
            ], '');

        addSyntaxMode(155, {
            name: 'info',
            type: 'substition',
            entries: [{
                match: /~~INFO:/,
                style: 'meta'
            }],
            token: function(stream, state) {
                var style;
                if (stream.match(/^~~/)) {
                    state.current = state.stack.pop();
                    style = 'meta';
                } else if (stream.match(_info_keywords)) {
                    style = 'keyword';
                } else {
                    stream.next();
                    style = 'error';
                }
                return tokenStyles(state, style);
            }
        });

    }

    /* Plugin fontsize2 */

    if (parserConfig.plugins.indexOf('fontsize2') !== -1) {
        addSyntaxMode(91, {
            name: 'fontsize2',
            type: 'formatting',
            allowedTypes: ['formatting', 'substition', 'disabled'],
            entries: [{match: /<fs(\s+[^>]*)?>/, style: 'tag'}],
            patterns: [{match: '</fs>', exit: true, style: 'tag'}]
        });
    }

    /* Plugin color */

    if (parserConfig.plugins.indexOf('color') !== -1) {
        addSyntaxMode(158, {
            name: 'color',
            type: 'formatting',
            allowedTypes: ['formatting', 'substition', 'disabled'],
            entries: [{match: /<color(\s+[^>]*)?>/, style: 'tag'}],
            patterns: [{match: '</color>', exit: true, style: 'tag'}]
        });
    }

    /* Plugin randompage2 */

    if (parserConfig.plugins.indexOf('randompage2') !== -1) {
        addSyntaxMode(158, {
            name: 'randompage2',
            type: 'formatting',
            allowedTypes: ['formatting', 'substition', 'disabled'],
            entries: [{match: '<randompage_link>', style: 'tag'}],
            patterns: [{match: '</randompage_link>', exit: true, style: 'tag'}]
        });
    }

    /* Plugin vshare */

    if (parserConfig.plugins.indexOf('vshare') !== -1) {

        var _vshare_list = ['5min', 'archiveorg', 'bambuser', 'bliptv', 'break',
                            'clipfish', 'dailymotion', 'gtrailers', 'metacafe',
                            'myspacetv','odysee', 'rcmovie', 'scivee',
                            'twitchtv', 'slideshare', 'ustream', 'veoh',
                            'viddler','vimeo', 'youtube'];

        addSyntaxMode(159, {
            name: 'vshare',
            type: 'substition',
            entries: [{
                match: new RegExp('\\{\\{ ?(' + _vshare_list.join('|') + ')>'),
                style: 'tag'
            }],
            token: function(stream, state) {
                var style;
                if (stream.match(/^\}\}/)) {
                    state.current = state.stack.pop();
                    state.temp.is_link = false;
                    state.is_string = false;
                    style = 'tag';
                } else if (stream.match('|')) {
                    state.temp.is_link = false;
                    state.is_string = true;
                } else if (!state.is_string && stream.match(/[&?]/)) {
                    state.temp.is_link = true;
                } else if (state.temp.is_link) {
                    stream.next();
                    style = 'keyword';
                } else {
                    stream.next();
                    style = state.is_string ? 'string' : 'link';
                }
                return tokenStyles(state, style);
            }
        });

    }

    /* Plugin icons */

    if (parserConfig.plugins.indexOf('icons') !== -1) {

        var _icon_list = ['icon', 'fa', 'ra', 'glyphicon', 'typcn',
                          'mdi', 'fl', 'fugue', 'oxygen', 'breeze'];

        addSyntaxMode(299, {
            name: 'icons',
            type: 'substition',
            entries: [{
                match: new RegExp('\\{\\{(' + _icon_list.join('|') + ')>'),
                style: 'tag'
            }],
            token: function(stream, state) {
                var style;
                if (stream.match(/^\}\}/)) {
                    state.current = state.stack.pop();
                    state.temp.is_attr = false;
                    style = 'tag';
                } else if (stream.match(/&|\?/)) {
                    state.temp.is_attr = true;
                    style = 'operator';
                } else if (state.temp.is_attr) {
                    stream.next();
                    style = 'keyword';
                } else {
                    stream.next();
                    style = 'link';
                }
                return tokenStyles(state, style);
            }
        });

    }

    /* Plugin imagebox */

    if (parserConfig.plugins.indexOf('imagebox') !== -1) {

        addSyntaxMode(315, {
            name: 'imagebox',
            type: 'protected',
            allowedTypes: ['formatting', 'substition'],
            entries: [{match: /^\[\{\{ */}],
            token: function(stream, state) {
                var style;
                if (stream.match(/^ *\}\}\]/)) {
                    state.current = state.stack.pop();
                    state.linkParam = false;
                    state.linkTitle = false;
                } else if (state.linkTitle) {
                    style = 'string';
                    stream.next();
                } else if (stream.match(/^\s*\|/)) {
                    state.linkTitle = true;
                } else if (state.linkParam) {
                    if (stream.match(/^(?:nolink|direct|linkonly)/)) {
                        style = 'keyword';
                    } else if (stream.match(/^(?:nocache|recache)/)) {
                        style = 'meta';
                    } else if (stream.match(/^\d+(?:[xX]\d+)?/)) {
                        style = 'number';
                    } else if (!stream.match(/^\s+/)) {
                        stream.next();
                        style = 'error';
                    }
                } else if (stream.match(/^\?(?=[^\?]*$)/)) {
                    state.linkParam = true;
                } else {
                    stream.next();
                    style = 'link';
                }
                return tokenStyles(state, style);
            },
        });

    }

    /* Plugin orphanswanted */

    if (parserConfig.plugins.indexOf('orphanswanted') !== -1) {

        var _orphanswanted_keywords = wordsRegExp([
                'orphans', 'wanted', 'valid', 'all'
            ], '');

        addSyntaxMode(990, {
            name: 'orphanswanted',  // 990
            type: 'substition',
            entries: [{
                match: /~~ORPHANSWANTED:/,
                style: 'meta'
            }],
            token: function(stream, state) {
                var style;
                if (stream.match(/^~~/)) {
                    state.current = state.stack.pop();
                    state.temp.is_link = false;
                    style = 'meta';
                } else if (stream.match('!')) {
                    state.temp.is_link = true;
                } else if (state.temp.is_link) {
                    stream.next();
                    style = 'string';
                } else if (stream.match(_orphanswanted_keywords)) {
                    style = 'keyword';
                } else {
                    stream.next();
                    style = 'error';
                }
                return tokenStyles(state, style);
            }
        });
    }

    /* Plugin Mathjax (Customized setting) */

    if (parserConfig.plugins.indexOf('mathjax') !== -1) {

        addSyntaxMode(65, {
            name: 'mathjax_inline',
            type: 'protected',
            entries: [{match: '<math>', style: 'tag', lang: 'latex'}],
            patterns: [{match: '</math>', style: 'tag', exit: true}]
        });

        addSyntaxMode(65, {
            name: 'mathjax_block',
            type: 'protected',
            entries: [{match: '<MATH>', style: 'tag', lang: 'latex'}],
            patterns: [{match: '</MATH>', style: 'tag', exit: true}]
        });

    }

    /* Plugin changes */

    if (parserConfig.plugins.indexOf('changes') !== -1) {

        addSyntaxMode(50, {
            name: 'changes',
            type: 'substition',
            entries: [{
                match: '{{changes>',
                style: 'tag'
            }],
            token: function(stream, state) {
                var style;
                if (stream.match(/^\}\}/)) {
                    state.current = state.stack.pop();
                    style = 'tag';
                } else if (stream.match(/&|=/)) {
                    style = 'operator';
                } else if (stream.match(/[^&=]+?(?==)/)) {
                    style = 'attribute';
                } else {
                    style = 'string';
                    stream.next();
                }
                return tokenStyles(state, style);
            }
        });

    }

    /* Plugin adhoctags */

    if (parserConfig.plugins.indexOf('adhoctags') !== -1) {

        var adHocTagsAttrMode = {
            // Dummy mode for attribute parsing.
            name: 'adhoctags_attr',
            type: 'formatting',
            allowedTypes: ['container', 'formatting', 'baseonly',
                           'substition', 'protected', 'disabled'],
            entries: [{
                match: '',
                style: 'string'
            }],
            token: function(stream, state) {
                var style;
                if (stream.match('>')) {
                    state.current = state.stack.pop();
                    state.temp.is_ext_attr = false;
                    style = 'tag';
                } else if (stream.match(']')) {
                    state.temp.is_ext_attr = false;
                    style = 'bracket';
                } else if (stream.match('[')) {
                    state.temp.is_ext_attr = true;
                    style = 'bracket';
                } else if (
                    state.temp.is_ext_attr &&
                    stream.match(/[^\]]+(?==)/)
                ) {
                    style = 'attribute';
                } else if (state.temp.is_ext_attr && stream.match('=')) {
                    style = 'operator';
                } else if (state.temp.is_ext_attr) {
                    stream.next();
                    style = 'string';
                } else {
                    stream.next();
                    style = 'attribute';
                }
                return tokenStyles(state, style);
            }
        };

        var _adhoctags = [
            'article', 'header', 'footer', 'address',
            'cite', 'time', 'dfn', 'kbd', 'samp', 'var', 'bdi', 'bdo', 'dl',
            'dd', 'summary', 'div', 'aside', 'section', 'figure', 'figcaption',
            'q', 'abbr', 'mark', 'strong', 'small', 'em', 'h1', 'h2', 'h3',
            'h4', 'h5', 'h6', 'dt', 'details', 'span', 'pre',
            'b', 'i', 's', 'u', 'a'
        ];

        for (i = 0; i<_adhoctags.length; i += 1) {
            addSyntaxMode(195, {
                name: 'adhoctags_' + _adhoctags[i],
                type: 'formatting',
                allowedTypes: ['container', 'formatting', 'baseonly',
                               'substition', 'protected', 'disabled'],
                entries: [{
                    match: new RegExp('<' + _adhoctags[i] + '(?= .+?>|>)'),
                    style: 'tag',
                    push: adHocTagsAttrMode  // Push attribute parsing mode
                }],
                patterns: [{
                    match: '</' + _adhoctags[i] + '>',
                    exit: true,
                    style: 'tag'
                }]
            });
        }

        addSyntaxMode(195, {
            // duplication to handle nested tags
            name: 'adhoctags_div',
            type: 'formatting',
            allowedTypes: ['container', 'formatting', 'baseonly',
                           'substition', 'protected', 'disabled'],
            entries: [{
                match: new RegExp('<div(?= .+?>|>)'),
                style: 'tag',
                push: adHocTagsAttrMode
            }],
            patterns: [
                {match: '</div>', exit: true, style: 'tag'}
            ]
        });

        addSyntaxMode(195, {
            // duplication to handle nested tags
            name: 'adhoctags_span',
            type: 'formatting',
            allowedTypes: ['container', 'formatting', 'baseonly',
                           'substition', 'protected', 'disabled'],
            entries: [{
                match: new RegExp('<span(?= .+?>|>)'),
                style: 'tag',
                push: adHocTagsAttrMode
            }],
            patterns: [
                {match: '</span>', exit: true, style: 'tag'}
            ]
        });

    }

    /* Plugin comment */

    if (parserConfig.plugins.indexOf('comment') !== -1) {

        addSyntaxMode(321, {
            name: 'plugin_comment',
            type: 'substition',
            entries: [{match: '/*'}],
            patterns: [{match: '*/', exit: true}],
            style: 'comment'
        });

    }

    /* Plugin numberedheadings

    if (parserConfig.plugins.indexOf('numberedheadings') !== -1) {

        addSyntaxMode(45, {
            name: 'numberedheadings',
            type: 'baseonly',
            entries: [{match: /={2,} +(?=-)/, sol: true, style: 'def'}],
            token: function(stream, state) {
                var style;
                if (stream.match(/^={2,}/)) {
                    state.current = state.stack.pop();
                    style = 'def';
                } else if (stream.match('-')) {
                    style = 'meta';
                } else if (stream.match(/^#[0-9]+/)) {
                    style = 'keyword';
                } else if (stream.match(/\[.+?\]/)) {
                    style = 'string';
                } else {
                    stream.next();
                    style = 'def';
                }
                return tokenStyles(state, style);
            }
        });

        addSyntaxMode(45, {
            name: 'numberedheadings_macro',
            type: 'baseonly',
            entries: [{
                match: /~~HEADLINE NUMBERING FIRST LEVEL = [1-5]~~/,
                style: 'meta', exit: true}
            ]
        });

    }

    */

    /* Return dokuwiki mode */

    var sorted_key = Object.keys(syntaxModes).sort(
        function(a, b) {
            return Number(a) - Number(b);
        }
    );

    for (i = 0; i < sorted_key.length; i += 1) {
        dokuModes = dokuModes.concat(syntaxModes[sorted_key[i]]);
    }

    connectDokuModes();

    return mode;

    function escapeRegExp(string) {
        return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
    }

    function wordsRegExp(words, end, flags) {
        var escapedWords = [];
        for (var i = 0; i < words.length; i += 1) {
            escapedWords.push(escapeRegExp(words[i]));
        }
        end = end || '';
        flags = flags || '';
        return new RegExp('^(?:' + escapedWords.join('|') + ')' + end, flags);
    }

    function emailLinkRegExp() {
        var text = '[0-9a-zA-Z!#$%&\'*+/=?^_`{|}~-]+';
        var email = (text + '(?:\\.' + text + ')*@' +
                     '(?:[0-9a-z][0-9a-z-]*\\.)+(?:[a-z]{2,4}|museum|travel)');
        return new RegExp('^<' + email + '>', 'i');
    }

    function externalLinkRegExp(schemes) {
        var punc = '.:?\\-;,';
        var host = '\\w' + punc;
        var any = '\\w/\\#~:.?+=&%@!\\-\\[\\]' + punc;
        var patterns = [];
        for (var i = 0; i < schemes.length; i += 1) {
            patterns.push(schemes[i] + '://[' + any + ']+?(?=[' +
                          punc + ']*[^' + any + ']|$)');
        }
        patterns.push('www?\\.[' + host + ']+?\\.[' + host + ']+?[' +
                      any + ']+?(?=[' + punc + ']*[^' + any + ']|$)');
        patterns.push('ftp?\\.[' + host + ']+?\\.[' + host + ']+?[' +
                      any + ']+?(?=[' + punc + ']*[^' + any + ']|$)');
        return new RegExp('^(?:' + patterns.join('|') + ')', 'i');
    }

    function fileLinkRegExp() {
        var punc = '.:?\\-;,';
        var any = '\\w/\\#~:.?+=&%@!\\-\\[\\]' + punc;
        return new RegExp('^file://[' + any + ']+?(?=[' + punc + ']*[^' +
                          any + ']|$)', 'i');
    }

    function enterInnerMode(state, lang) {
        state.innerMode = parserConfig.loadMode(lang);
        if (state.innerMode.startState) {
            state.innerState = state.innerMode.startState();
        }
        state.blockCommentStart = state.innerMode.blockCommentStart;
        state.blockCommentEnd = state.innerMode.blockCommentEnd;
        state.lineComment = state.innerMode.lineComment;
        state.electricChars = state.innerMode.electricChars;
        state.electricInput = state.innerMode.electricInput;
    }

    function exitInnerMode(state) {
        state.innerMode = null;
        state.innerState = null;
        state.blockCommentStart = null;
        state.blockCommentEnd = null;
        state.lineComment = null;
        state.electricChars = null;
        state.electricInput = null;
    }

    function matchPatterns(stream, state, patterns) {
        if (!patterns) {
            return null;
        }

        var behind = stream.string.slice(stream.lineStart, stream.pos);

        for (var i = 0; i < patterns.length; i += 1) {
            var p = patterns[i];
            if (p.sol && !stream.sol()) {
                continue;
            }
            if (p.behind && !p.behind.test(behind)) {
                continue;
            }
            if (p.match && !stream.match(p.match)) {
                continue;
            }
            return patterns[i];
        }

        return null;
    }

    function codeToken(stream, state) {
        // Token function that parses code/file parameters

        if (state.innerMode) {
            return;
        }

        if (stream.match('>')) {
            enterInnerMode(state, state.codeLang);
            state.codeLang = null;
            state.codeFilename = false;
            return tokenStyles(state, 'tag');
        }

        if (stream.match(/^\s+/)) {
            return tokenStyles(state);
        }

        if (stream.match(/^[^\s>]+/)) {
            var style;
            if (!state.codeLang) {
                state.codeLang  = stream.current();
                if (parserConfig.validLang(state.codeLang)) {
                    style = 'keyword';
                } else {
                    style = 'error';
                }
            } else if (!state.codeFilename) {
                state.codeFilename = true;
                style = 'string';
            } else {
                style = 'error';
            }
            return tokenStyles(state, style);
        }
    }

    function dokuToken(stream, state) {
        var allowed = state.current.allowedModes;
        var pattern, style;

        // Match patterns
        for (var i = 0; !pattern && i < allowed.length; i += 1) {
            if (allowed[i] === state.current) {
                // Try custom function first
                if (state.current.token) {
                    style = state.current.token(stream, state);
                    if (stream.current()) {
                        return style;
                    }
                }
                pattern = matchPatterns(stream, state, allowed[i].patterns);
            } else {
                pattern = matchPatterns(stream, state, allowed[i].entries);
                if (pattern) {
                    state.stack.push(state.current);
                    state.current = allowed[i];
                    if (pattern.lang) {
                        enterInnerMode(state, pattern.lang);
                    }
                    if (pattern.push) {
                        pattern.push.allowedModes =
                            [ pattern.push ].concat(
                                state.current.allowedModes
                            );
                        state.stack.push(state.current);
                        state.current = pattern.push;
                    }
                }
            }
        }

        if (pattern) {
            if (pattern.exit) {
                state.exit = true;
            }
            return tokenStyles(state, pattern.style);
        } else {
            return tokenStyles(state);
        }

    }

    function tokenStyles(state, style) {
        var styles = [];

        for (var i = 0; i < state.stack.length; i += 1) {
            if (state.stack[i].style) {
                styles.push(state.stack[i].style);
            }
        }

        if (state.current.style) {
            styles.push(state.current.style);
        }

        if (style) {
            styles.push(style);
        }

        return styles.join(' ') || null;
    }

    function connectDokuModes() {
        for (var i = 0; i < dokuModes.length; i += 1) {
            var src = dokuModes[i];
            src.allowedModes = [];
            if (src.allowedTypes) {
                connectMode(src);
            } else {
                src.allowedModes.push(src);
            }
        }

        function connectMode(src) {
            for (var i = 0; i < dokuModes.length; i += 1) {
                var dest = dokuModes[i];
                if (src === dest || allowsType(src, dest.type)) {
                    src.allowedModes.push(dest);
                }
            }
        }

        function allowsType(mode, type) {
            for (var i = 0; i < mode.allowedTypes.length; i += 1) {
                if (mode.allowedTypes[i] === type) {
                    return true;
                }
            }
            return false;
        }
    }

});
