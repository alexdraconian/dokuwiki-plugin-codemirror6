<?php
/**
 * CodeMirror plugin for DokuWiki
 *
 * @author Albert Gasset <albertgasset@fsfe.org>
 * @license GNU GPL version 2 or later
 * @modified 2026-08-28: migrated and adapted for the CodeMirror 6 plugin.
 * @see https://github.com/albertgasset/dokuwiki-plugin-codemirror
 */

if(!defined('DOKU_INC')) die();

require_once DOKU_INC . 'inc/parser/parser.php';

class action_plugin_codemirror6 extends DokuWiki_Action_Plugin {

    static $actions = array('edit', 'create', 'source', 'preview',
                            'locked', 'draft', 'recover', 'show');

    public function register(Doku_Event_Handler $controller) {
        $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE',
                                   $this, 'handle_tpl_metaheader_output');
        $controller->register_hook('AJAX_CALL_UNKNOWN', 'BEFORE',
                                   $this, 'handle_ajax_call');
    }

    public function handle_tpl_metaheader_output(Doku_Event &$event, $param) {
        global $ACT, $INFO, $ID, $conf;

        if ($ACT == 'show' and !$this->getConf('codesyntax')) {
            return;
        }

        if (!in_array($ACT, self::$actions)) {
            return;
        }

        $info = $this->getInfo();
        $version = str_replace('-', '', $info['date']);
        $base_url = DOKU_BASE . 'lib/plugins/codemirror6';
        $acronyms = array_keys(getAcronyms());
        usort($acronyms, array($this,'compare'));

        $plugin_list = array();

        foreach (plugin_list('syntax') as $plugin) {
            $plugin = explode("_", $plugin)[0];
            if (!in_array($plugin, $plugin_list)) {
                $plugin_list[] = $plugin;
            }
        }

        $jsinfo = array(
            'acronyms' => $acronyms,
            'baseURL' => $base_url,
            'camelcase' => (bool) $conf['camelcase'],
            'codesyntax' => $this->getConf('codesyntax'),
            'entities' => array_keys(getEntities()),
            'iconURL' => "$base_url/settings.png",
            'nativeeditor' => $this->getConf('nativeeditor'),
            'pageautocomplete' => $this->getConf('pageautocomplete'),
            'pageautocompleteEndpoint' => DOKU_BASE . 'lib/exe/ajax.php',
            'pageautocompleteCall' => 'plugin_codemirror6_page_completion',
            'pageautocompleteNamespace' => isset($ID) ? getNS($ID) : '',
            'pageautocompleteLimit' => 30,
            'schemes' => array_values(getSchemes()),
            'smileys' => array_keys(getSmileys()),
            'version' => $version,
            'usenativescroll' => $this->getConf('usenativescroll'),
            'autoheight' => $this->getConf('autoheight'),
            'plugins' => $plugin_list
        );

        $event->data['link'][] = array(
            'rel' => 'stylesheet',
            'type' => 'text/css',
            'href' => "$base_url/dist/cm6/styles.min.css?v=$version",
        );

        $event->data['script'][] = array(
            'type' => 'text/javascript',
            '_data' => 'JSINFO.plugin_codemirror6 = ' . json_encode(
                $jsinfo,
                JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
            ) . '; JSINFO.plugin_codemirror = JSINFO.plugin_codemirror6;',
        );

        $event->data['script'][] = array(
            'type' => 'text/javascript',
            'charset' => 'utf-8',
            'src' => "$base_url/dist/cm6/scripts.min.js?v=$version",
            'defer' => 'defer',
        );
    }

    /**
     * Handle page completion requests without sending the complete page index to
     * the editor during page load.
     *
     * @param Doku_Event $event
     * @param mixed $param
     */
    public function handle_ajax_call(Doku_Event &$event, $param)
    {
        if ($event->data !== 'plugin_codemirror6_page_completion') {
            return;
        }

        $event->stopPropagation();
        $event->preventDefault();

        global $INPUT;

        $query = trim($INPUT->post->str('q'));
        $limit = (int) $INPUT->post->str('limit');
        if ($limit < 1) {
            $limit = 30;
        }
        $limit = min($limit, 50);

        $items = $this->findPageCompletions($query);
        $has_more = count($items) > $limit;
        if ($has_more) {
            $items = array_slice($items, 0, $limit);
        }

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(
            array(
                'items' => $items,
                'hasMore' => $has_more,
            ),
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
        );
    }

    /**
     * Find readable page completions using DokuWiki's own
     * link wizard search behavior.
     *
     * @param string $query
     *
     * @return array<int, array{pageid: string, title: string, kind: "page"}>
     */
    protected function findPageCompletions($query)
    {
        global $conf;

        $q = ltrim(trim($query), ':');
        $id = cleanID(noNS($q));
        $ns = cleanID(getNS($q));
        $nsd = utf8_encodeFN(str_replace(':', '/', $ns));
        $data = array();

        if ($q !== '' && $ns === '') {
            $pages = $this->pageLookup($id, true);

            // Keep page ID discovery independent from optional title metadata.
            // Some search backends omit pages that have no first heading.
            foreach ($this->pageIdLookup($id) as $page_id => $title) {
                if (!array_key_exists($page_id, $pages)) {
                    $pages[$page_id] = $title;
                }
            }

            if (($conf['useheading'] ?? '') == '1' || ($conf['useheading'] ?? '') == 'content') {
                $pages = array_merge($pages, $this->pageLookup($q, true, true));
                asort($pages, SORT_STRING);
            }

            foreach ($pages as $page_id => $title) {
                $data[] = array(
                    'id' => $page_id,
                    'title' => $title,
                    'type' => 'f',
                );
            }
        } else {
            $opts = array(
                'depth' => 1,
                'listfiles' => true,
                'listdirs' => false,
                'pagesonly' => true,
                'firsthead' => true,
                'sneakyacl' => $conf['sneaky_index'] ?? false,
            );
            if ($id) {
                $opts['filematch'] = '^.*\/' . $id;
            }

            search($data, $conf['datadir'], 'search_universal', $opts, $nsd);
        }

        $items = array();
        $seen = array();

        foreach ($data as $item) {
            if (!is_array($item) || !isset($item['id'])) {
                continue;
            }

            $page_id = trim((string) $item['id'], ':');
            if ($page_id === '') {
                continue;
            }

            if (!isset($item['type']) || $item['type'] !== 'f') {
                continue;
            }

            $key = 'page:' . $page_id;
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $items[] = array(
                'pageid' => $page_id,
                'title' => isset($item['title']) && is_string($item['title']) ?
                    $item['title'] : '',
                'kind' => 'page',
            );
        }

        return $items;
    }

    /**
     * Use the search API available in the current DokuWiki version.
     *
     * @param string $query
     * @param bool $in_ns
     * @param bool $in_title
     *
     * @return array<string, string|null>
     */
    protected function pageLookup($query, $in_ns = false, $in_title = false)
    {
        if (function_exists('ft_pageLookup')) {
            $pages = ft_pageLookup($query, $in_ns, $in_title);
            return is_array($pages) ? $pages : array();
        }

        if (class_exists('\\dokuwiki\\Search\\MetadataSearch')) {
            $search = new \dokuwiki\Search\MetadataSearch();
            $pages = $search->pageLookup($query, $in_ns, $in_title);
            return is_array($pages) ? $pages : array();
        }

        return array();
    }

    /**
     * Return readable page IDs matching a page-name query, including pages
     * whose first heading is not available.
     *
     * @param string $query
     *
     * @return array<string, string|null>
     */
    protected function pageIdLookup($query)
    {
        $pages = array();
        if (!function_exists('idx_get_indexer')) {
            return $pages;
        }

        $indexer = idx_get_indexer();
        if (!is_object($indexer) || !method_exists($indexer, 'getPages')) {
            return $pages;
        }

        $page_ids = $indexer->getPages();
        if (!is_array($page_ids)) {
            return $pages;
        }

        foreach ($page_ids as $page_id) {
            if (!is_string($page_id) || strpos($page_id, $query) === false) {
                continue;
            }

            if (
                !page_exists($page_id) ||
                auth_quickaclcheck($page_id) < AUTH_READ ||
                isHiddenPage($page_id)
            ) {
                continue;
            }

            $pages[$page_id] = p_get_first_heading($page_id, METADATA_DONT_RENDER);
        }

        return $pages;
    }
    /**
     * copied from \dokuwiki\Parsing\ParserMode\Acronym
     *
     * sort callback to order by string length descending
     *
     * @param string $a
     * @param string $b
     *
     * @return int
     */
    protected function compare($a, $b)
    {
        $a_len = strlen($a);
        $b_len = strlen($b);
        if ($a_len > $b_len) {
            return -1;
        } elseif ($a_len < $b_len) {
            return 1;
        }

        return 0;
    }
}
