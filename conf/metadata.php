<?php
/**
 * CodeMirror 6 Plugin for DokuWiki
 *
 * This project is a substantially modified work based on the DokuWiki
 * CodeMirror plugin by Albert Gasset and contributors:
 * https://github.com/albertgasset/dokuwiki-plugin-codemirror
 *
 * Modified 2026-08-28 for the CodeMirror 6 migration.
 * @license GNU GPL version 2 or later
 */

require_once(DOKU_INC.'lib/plugins/codemirror6/action.php');

$meta['nativeeditor'] = array('onoff');
$meta['codesyntax'] = array('onoff');
$meta['pageautocomplete'] = array('onoff');
$meta['usenativescroll'] = array('onoff');
$meta['autoheight'] = array('onoff');
