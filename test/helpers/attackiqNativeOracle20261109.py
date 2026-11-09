"""Independent, offline AttackIQ checks over original HTML and literal JS data.

This reader never imports production extractors or executes publisher programs.
The supported widget bootstrap is finite; unfamiliar control flow is rejected.
"""
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit
import json
import re
import runpy

_html = runpy.run_path(str(Path(__file__).with_name('base64aiNativeOracle20261108.py')))
Document, authored, cls, beneath, norm = [_html[key] for key in ['Document', 'authored', 'cls', 'beneath', 'norm']]
PRIMARY = 'https://www.attackiq.com/who-we-are/careers/'
BOARD = PRIMARY + 'openings/'
HELPER = 'https://app.jazz.co/widgets/basic/create/AttackIQ'


def carrier(document, node):
    assert document.outer(node) is not None
    value = dict(attrs=node['attrs'], nativeHTML=document.outer(node), authoredText=authored(node))
    if not node['active']:
        value['inactive'] = True
    return value


def document_head(document):
    heads = [node for node in document.nodes if node['tag'] == 'head']
    assert len(heads) == 1 and heads[0]['active'] and heads[0]['parent']['tag'] == 'html'
    identities = [node for node in document.nodes if node['tag'] == 'title'
                  or node['tag'] == 'link' and 'canonical' in node['attrs'].get('rel', '').lower().split()
                  or node['tag'] == 'meta' and node['attrs'].get('property', '').lower() == 'og:url']
    assert all(node['active'] and beneath(node, heads[0]) for node in identities)
    return dict(titles=[authored(node) for node in document.nodes if node['tag'] == 'title'],
                canonicals=[node['attrs'].get('href') for node in document.nodes
                            if node['tag'] == 'link' and 'canonical' in node['attrs'].get('rel', '').lower().split()],
                metas=[node['attrs'] for node in document.nodes if node['tag'] == 'meta'],
                schemas=[dict(attrs=node['attrs'], raw=document.inner(node)) for node in document.nodes
                         if node['tag'] == 'script' and node['attrs'].get('type', '').split(';')[0].strip().lower() == 'application/ld+json'])


def primary(source):
    document = Document(source)
    head = document_head(document)
    assert head['titles'] == ['Careers with AttackIQ - AttackIQ'] and head['canonicals'] == [PRIMARY]
    handoffs = [node for node in document.nodes if node['tag'] == 'a'
                and (node['attrs'].get('href') == BOARD or authored(node) in ['Explore Open Opportunities', 'Apply with AttackIQ Today'])]
    assert handoffs and all(node['active'] and node['attrs'].get('href') == BOARD and authored(node)
                            and not meaningful_inactive(document, node) for node in handoffs)
    return dict(sourcePage=PRIMARY, head=head,
                nativeHeadings=[dict(tag=node['tag'], **carrier(document, node)) for node in document.nodes if node['tag'] == 'h1'],
                nativeHandoffs=[dict(**carrier(document, node), url=BOARD) for node in handoffs])


def unique_json(pairs):
    output = {}
    for key, value in pairs:
        assert key not in output
        output[key] = value
    return output


def detail(source, url):
    route = urlsplit(url)
    assert route.scheme == 'https' and route.netloc == 'attackiq.applytojob.com' and not route.fragment
    match = re.fullmatch(r'/apply/([A-Za-z0-9]+)/[^/]+', route.path)
    assert match
    document = Document(source)
    head = document_head(document)
    bodies = [node for node in document.nodes if node['tag'] == 'body']
    assert len(bodies) == 1 and bodies[0]['active']
    claims = set(value for value in bodies[0]['attrs'].get('class', '').split() if value.startswith('job-'))
    assert claims == {'job-' + match[1]}
    schemas, organizations = [], []
    for node in document.nodes:
        if node['tag'] != 'script' or node['attrs'].get('type', '').split(';')[0].strip().lower() != 'application/ld+json':
            continue
        assert node['active'] and 'src' not in node['attrs']
        raw = document.inner(node)
        value = json.loads(raw, object_pairs_hook=unique_json)
        assert value.get('@type') == 'Organization'
        schemas.append(dict(attrs=node['attrs'], nativeHTML=document.outer(node), rawJSON=raw, value=value))
        organizations.append(value)
    assert len(organizations) == 1 and organizations[0].get('name') == 'AttackIQ'
    headers = [node for node in document.nodes if cls(node, 'job-header')]
    titles = [node for node in document.nodes if node['tag'] == 'h2' and any(beneath(node, header) for header in headers)]
    metadata = [node for node in document.nodes if cls(node, 'job-attributes-container')]
    descriptions = [node for node in document.nodes if node['attrs'].get('id') == 'job-description']
    assert len(headers) == len(titles) == len(metadata) == len(descriptions) == 1
    assert all(node['active'] and not meaningful_inactive(document, node) for node in headers + titles + metadata + descriptions)
    assert head['titles'] == [authored(titles[0]) + ' - AttackIQ - Career Page']
    def same_route(value):
        candidate = urlsplit(urljoin(url, value))
        return (candidate.scheme, candidate.netloc, candidate.path, candidate.fragment) == ('https', route.netloc, route.path, '')
    assert len(head['canonicals']) == 1 and all(same_route(value) for value in head['canonicals'])
    assert all(same_route(value.get('content', '')) for value in head['metas'] if value.get('property') == 'og:url')
    attributes = [node for node in metadata[0]['children'] if isinstance(node, dict) and node['tag'] == 'div']
    criteria = norm(' '.join(authored(node) for node in descriptions))
    assert criteria
    return dict(sourcePage=url, head=head, nativeSchemaCarriers=schemas, nativeOrganizationRecords=organizations,
                nativeBodyClaims=[dict(attrs=node['attrs']) for node in bodies],
                nativeHeaders=[carrier(document, node) for node in headers],
                nativeTitleCarriers=[carrier(document, node) for node in titles],
                nativeMetadataCarriers=[carrier(document, node) for node in metadata],
                nativeAttributeRecords=[carrier(document, node) for node in attributes],
                nativeDescriptionCarriers=[carrier(document, node) for node in descriptions],
                fullCriteriaText=criteria, nativeAuthoredCriteriaAvailable=True)


import hashlib
import os
import subprocess
import shutil
from functools import lru_cache
from urllib.parse import parse_qsl


def raw_authored(node):
    if isinstance(node, str):
        return node
    if node['tag'] in {'script', 'style', 'noscript', 'title'}:
        return ''
    return norm(' '.join(raw_authored(child) for child in node['children']))


def meaningful_inactive(document, root):
    return any(not node['active'] and beneath(node, root) and raw_authored(node)
               for node in document.nodes)


_node_executable = None

def configure_runtime(node_executable):
    global _node_executable
    _node_executable = node_executable
    node_runtime.cache_clear()

@lru_cache(maxsize=1)
def node_runtime():
    repo = Path(__file__).resolve().parents[2]
    node = Path(_node_executable or shutil.which('node') or '')
    assert node.is_file()
    guard = repo / 'reports/scraper-2026-11-05-resume-20261109/offline-network-guard.mjs'
    if not guard.is_file():
        guard = repo / 'test/helpers/offlineNativeOracle20261109.mjs'
    assert hashlib.sha256(guard.read_bytes()).hexdigest() == '21b7d6a505de2d0b90ba7b4b5f4ea8ddb773b4d5243d03f3fe085957efb46811'
    return repo, node, guard


def javascript_tree(source):
    # Acorn parses syntax only. Source bytes go through stdin, never eval/import.
    assert isinstance(source, str) and len(source) <= 524288
    repo, node, guard = node_runtime()
    program = "import {parse} from 'acorn';process.stdin.setEncoding('utf8');let source='';for await(const chunk of process.stdin)source+=chunk;process.stdout.write(JSON.stringify(parse(source,{ecmaVersion:'latest'})));"
    env = {key: value for key, value in os.environ.items() if key.upper() not in {'NODE_OPTIONS', 'NODE_PATH'}}
    result = subprocess.run([str(node), '--import', guard.as_uri(), '--input-type=module', '-e', program],
                            cwd=repo, env=env, input=source.encode('utf8'), capture_output=True, timeout=15)
    if result.returncode or result.stderr or len(result.stdout) > 8 * 1024 * 1024:
        raise ValueError('Unusable native JavaScript syntax')
    return json.loads(result.stdout)


def static_string(node):
    if node.get('type') == 'Literal' and isinstance(node.get('value'), str):
        return node['value']
    if node.get('type') == 'TemplateLiteral' and not node['expressions'] and len(node['quasis']) == 1:
        return node['quasis'][0]['value']['cooked']
    return None


def shape(value):
    if isinstance(value, list):
        return [shape(item) for item in value]
    if not isinstance(value, dict):
        return value
    literal = static_string(value)
    if literal is not None:
        return {'type': 'StaticString', 'value': literal}
    return {key: shape(child) for key, child in value.items() if key not in {'start', 'end', 'raw'}}


BOOTSTRAP = '''var resumatorScript=document.currentScript;
if(document.body && document.body?.contains(resumatorScript)) {
resumatorScript.insertAdjacentHTML('afterend','<div id="resumator-wrapper"></div>');insertResumatorWrapper();
} else {window.onload=function(){var body=document.body;
body.insertAdjacentHTML('afterbegin','<div id="resumator-wrapper"></div>');insertResumatorWrapper();};}'''
LOADER = '''if(typeof window.jQuery === "undefined") {
var jqueryScript=document.createElement("script");jqueryScript.type="text/javascript";jqueryScript.charset="utf-8";
jqueryScript.src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js";
var noConflictScript=document.createElement("script");noConflictScript.type="text/javascript";
noConflictScript.appendChild(document.createTextNode("$.noConflict();"));
var resumatorScript=document.currentScript;resumatorScript.after(jqueryScript);resumatorScript.after(noConflictScript);}'''


@lru_cache(maxsize=1)
def supported_shapes():
    body = javascript_tree(BOOTSTRAP + '\n' + LOADER)['body']
    return shape(body[:2]), shape(body[-1])


def helper(source):
    tree = javascript_tree(source)
    source_units = source.encode('utf-16-le')
    reference_bootstrap, reference_loader = supported_shapes()
    assert len(tree['body']) >= 4 and shape(tree['body'][:2]) == reference_bootstrap
    suffix = tree['body'][2:]
    assert shape(suffix[-1]) == reference_loader
    assert all(node['type'] == 'FunctionDeclaration' for node in suffix[:-1])
    declarations = suffix[:-1]
    names = [node['id']['name'] for node in declarations]
    assert len(set(names)) == len(names)
    for node in declarations:
        name = node['id']['name']
        assert not node['async'] and not node['generator']
        assert name in {'insertResumatorWrapper', 'resumatorFormatSource'} or re.fullmatch(r'resumator(?:Apply|Forward)Toggle[A-Za-z0-9]+', name)
        if name == 'resumatorFormatSource':
            assert len(node['params']) == 1 and node['params'][0]['type'] == 'Identifier'
        else:
            assert not node['params']
    nodes, count = [], 0
    def walk(node, ancestors=()):
        nonlocal count
        if not isinstance(node, dict) or 'type' not in node:
            return
        count += 1
        assert count <= 50000 and len(ancestors) <= 160
        nodes.append((node, ancestors))
        for child in node.values():
            for item in child if isinstance(child, list) else [child]:
                if isinstance(item, dict) and 'type' in item:
                    walk(item, ancestors + (node,))
    walk(tree)
    functions = [node for node, _ in nodes if node['type'] == 'FunctionDeclaration' and node.get('id', {}).get('name') == 'insertResumatorWrapper']
    assert len(functions) == 1 and any(node is functions[0] for node in suffix[:-1])
    function = functions[0]
    bindings = [node for node, _ in nodes if node['type'] == 'VariableDeclarator' and node.get('id', {}).get('name') == 'resumatorWrapper']
    assert len(bindings) == 1
    binding = bindings[0]; initial = binding.get('init', {}); callee = initial.get('callee', {})
    assert initial.get('type') == 'CallExpression' and callee.get('type') == 'MemberExpression' and not callee.get('computed')
    assert callee.get('object', {}).get('name') == 'document' and callee.get('property', {}).get('name') == 'getElementById'
    assert len(initial['arguments']) == 1 and static_string(initial['arguments'][0]) == 'resumator-wrapper'
    for node, _ in nodes:
        if node['type'] == 'AssignmentExpression':
            left = node['left']; prop = left.get('property', {})
            assert left.get('name') not in {'resumatorWrapper', 'insertResumatorWrapper'}
            assert (prop.get('name') or static_string(prop)) not in {'resumatorWrapper', 'insertResumatorWrapper'}
    calls = [(node, ancestors) for node, ancestors in nodes if node['type'] == 'CallExpression'
             and node.get('callee', {}).get('type') == 'MemberExpression'
             and not node['callee'].get('computed') and node['callee'].get('property', {}).get('name') == 'insertAdjacentHTML']
    for statement in function['body']['body']:
        assert (statement['type'] == 'VariableDeclaration' and len(statement['declarations']) == 1 and statement['declarations'][0] is binding
                or statement['type'] == 'ExpressionStatement' and any(statement['expression'] is call for call, _ in calls))
    insertions, widgets, records = [], [], []
    for call, ancestors in calls:
        receiver = call['callee'].get('object', {}).get('name')
        assert receiver and len(call['arguments']) == 2
        placement, html = [static_string(value) for value in call['arguments']]
        assert placement is not None and html is not None
        insertions.append(dict(receiver=receiver, placement=placement,
            nativeJavaScript=source_units[2 * call['start']:2 * call['end']].decode('utf-16-le'), nativeHTMLLiteral=html))
        document = Document(html)
        own_widgets = [node for node in document.nodes if node['attrs'].get('id') == 'resumator-widget']
        nearest_function = next((node for node in reversed(ancestors) if node['type'] in {'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'}), None)
        owned = (receiver == 'resumatorWrapper' and placement == 'beforeend' and nearest_function is function
                 and len(ancestors) >= 2 and ancestors[-2] is function['body'])
        for widget in own_widgets:
            assert owned and widget['active'] and not meaningful_inactive(document, widget)
            widgets.append(dict(insertionOrdinal=len(insertions) - 1, **carrier(document, widget)))
        for row in document.nodes:
            if not cls(row, 'resumator-job'):
                continue
            assert owned and len(own_widgets) == 1 and beneath(row, own_widgets[0]) and row['active']
            assert not meaningful_inactive(document, row)
            descendants = [node for node in document.nodes if beneath(node, row)]
            titles = [node for node in descendants if cls(node, 'resumator-job-title')]
            infos = [node for node in descendants if cls(node, 'resumator-job-info')]
            links = [node for node in descendants if node['tag'] == 'a' and 'href' in node['attrs']]
            detail_links = [node for node in links if cls(node, 'resumator-job-link') or re.fullmatch(r'\+?\s*View\s+details', authored(node), re.I)]
            assert len(titles) == len(detail_links) == 1 and titles[0]['active'] and authored(titles[0])
            target = detail_links[0]; route = urlsplit(urljoin(HELPER, target['attrs']['href']))
            assert target['active'] and route.scheme == 'https' and route.hostname == 'attackiq.applytojob.com'
            assert route.port in {None, 443} and not route.username and not route.password and not route.fragment
            assert re.fullmatch(r'/apply/[A-Za-z0-9]+/[^/]+', route.path)
            assert all(key == 'source' for key, _ in parse_qsl(route.query, keep_blank_values=True))
            records.append(dict(nativeObservationOrdinal=len(records), attrs=row['attrs'], nativeHTML=document.outer(row),
                nativeTitleCarriers=[carrier(document, node) for node in titles], nativeInfoCarriers=[carrier(document, node) for node in infos],
                links=[dict(attrs=node['attrs'], nativeHTML=document.outer(node), text=authored(node),
                            url=quote(urljoin(HELPER, node['attrs']['href']), safe=":/?&=;%@+$,!~*'()#[]")) for node in links]))
    assert len(widgets) == 1 and records
    return dict(sourcePage=HELPER, nativeInsertions=insertions, nativeWidgetCarriers=widgets, records=records)
