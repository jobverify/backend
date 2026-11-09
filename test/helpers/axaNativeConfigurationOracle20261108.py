"""Independent AXA board model oracle; parses native declarations as data only.

Parser functions retained verbatim from independent-native-models.py
(SHA256 b5b63db94952b2385b2141dd1176f22562aced057bba8357248bb001541a5ff0).
The historical capture generator and report-directory I/O are excluded.
"""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
import json, re, copy, hashlib

PRIMARY = 'https://careers.axa.com/careers-home/'
BOARD = 'https://careers.axa.com/careers-home/jobs'


def pairs(items):
    result = {}
    for key, value in items:
        assert key not in result, ('duplicate native JSON field', key)
        result[key] = value
    return result


def strict_json(source):
    return json.loads(source, object_pairs_hook=pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))


def norm(value):
    return ' '.join(value.split())


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = dict(tag='root', attrs={}, children=[], active=True, parent=None)
        self.stack = [self.root]
        self.nodes = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        parent = self.stack[-1]
        attributes = {}
        for key, value in attrs:
            if key not in attributes:
                attributes[key] = '' if value is None else value
        style = re.sub(r'/\*.*?\*/', '', attributes.get('style', ''), flags=re.S)
        hidden = any(key in attributes for key in ['hidden', 'inert']) or attributes.get('aria-hidden', '').lower() == 'true' or re.search(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)', style, re.I)
        active = parent['active'] and not hidden and tag not in ['template', 'noscript', 'svg', 'math', 'object']
        node = dict(tag=tag, attrs=attributes, children=[], active=bool(active), parent=parent)
        self.nodes.append(node)
        parent['children'].append(node)
        if tag not in ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.stack[-1]['tag'] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        index = next((i for i in range(len(self.stack) - 1, 0, -1) if self.stack[i]['tag'] == tag), None)
        if index is not None:
            del self.stack[index:]

    def handle_data(self, value):
        self.stack[-1]['children'].append(value)


def authored(node):
    if isinstance(node, str):
        return node
    if not node['active'] or node['tag'] in ['script', 'style', 'template', 'noscript']:
        return ''
    return norm(' '.join(authored(child) for child in node['children']))


def program(node):
    return ''.join(child for child in node['children'] if isinstance(child, str))


def head(document):
    selected = [node for node in document.nodes if node['active'] and node['parent']['tag'] == 'head']
    return dict(titles=[authored(node) for node in selected if node['tag'] == 'title'],
                canonicals=[node['attrs'].get('href') for node in selected if node['tag'] == 'link' and 'canonical' in node['attrs'].get('rel', '').split()],
                metas=[node['attrs'] for node in selected if node['tag'] == 'meta'])


def whitespace(source, index):
    while True:
        match = re.match(r'(?:\s+|//[^\n]*(?:\n|$)|/\*.*?\*/|<!--[^\n]*(?:\n|$)|-->[^\n]*(?:\n|$))', source[index:], re.S)
        if not match:
            return index
        index += len(match[0])


class DataLiteral:
    def __init__(self, source, index):
        self.source = source; self.index = index

    def space(self):
        self.index = whitespace(self.source, self.index)

    def value(self, depth=0):
        assert depth < 80; self.space(); source = self.source
        char = source[self.index]
        if char == "'":
            self.index += 1; result = []
            while self.index < len(source):
                char = source[self.index]; self.index += 1
                if char == "'":
                    return ''.join(result)
                if char != '\\':
                    result.append(char); continue
                escape = source[self.index]; self.index += 1
                if escape == 'u':
                    result.append(chr(int(source[self.index:self.index + 4], 16))); self.index += 4
                elif escape == 'x':
                    result.append(chr(int(source[self.index:self.index + 2], 16))); self.index += 2
                else:
                    result.append({'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f'}.get(escape, escape))
            raise ValueError('Unclosed native literal')
        if char == '{':
            self.index += 1; result = {}; self.space()
            while source[self.index] != '}':
                if source[self.index] in "\"'":
                    key = self.value(depth + 1)
                else:
                    match = re.match(r'[A-Za-z_$][\w$]*', source[self.index:]); assert match
                    key = match[0]; self.index += len(match[0])
                assert key not in result and key not in ['__proto__', 'prototype', 'constructor']; self.space()
                assert source[self.index] == ':'; self.index += 1
                result[key] = self.value(depth + 1); self.space()
                if source[self.index] == ',':
                    self.index += 1; self.space()
                else:
                    break
            assert source[self.index] == '}'; self.index += 1; return result
        if char == '[':
            self.index += 1; result = []; self.space()
            while source[self.index] != ']':
                result.append(self.value(depth + 1)); self.space()
                if source[self.index] == ',':
                    self.index += 1; self.space()
                else:
                    break
            assert source[self.index] == ']'; self.index += 1; return result
        value, self.index = json.JSONDecoder(object_pairs_hook=pairs).raw_decode(source, self.index)
        return value


def declarations(document):
    values = {}; assignments = []; carriers = []
    def read_path(path):
        at = values
        for key in path:
            if at is None:
                return None
            assert isinstance(at, dict)
            at = at.get(key)
        return at
    def write_path(path, value):
        assert all(key not in ['__proto__', 'prototype', 'constructor'] for key in path)
        at = values
        for key in path[:-1]:
            assert isinstance(at.get(key), dict); at = at[key]
        at[path[-1]] = value
    def truthy(value):
        return isinstance(value, (dict, list)) or bool(value)
    for node in document.nodes:
        if not node['active'] or node['tag'] != 'script' or node['attrs'].get('src') or not re.fullmatch(r'(?:|module|(?:text|application)/(?:java|ecma)script)', node['attrs'].get('type', ''), re.I):
            continue
        source = program(node); index = whitespace(source, 0)
        if not re.search(r'\b(?:_jibe|searchConfig)\b', source):
            continue
        # Exact original read-only analytics program; no query authority.
        if hashlib.sha256(source.encode()).hexdigest() == '87fe522db8fa457f8f9d47e6326dca3c330a3cdc445153c15e5ecc6d2d60a437':
            continue
        if not re.match(r'(?:(?:window\.)?(?:_jibe|searchConfig)(?:\.[A-Za-z_$][\w$]*)*\s*=|window\.validations\s*=\s*undefined\s*;|\(\s*window\._jibe)', source[index:]):
            raise ValueError('Unmodeled native configuration program or alias escape')
        carriers.append(dict(attrs=node['attrs'], nativeJavaScript=source))
        while index < len(source):
            start = index
            sidecar = re.match(r'window\.validations\s*=\s*undefined\s*;', source[index:])
            if sidecar:
                index = whitespace(source, index + len(sidecar[0])); continue
            fallback = re.match(r'\(\s*window\.(?P<base>_jibe(?:\.[A-Za-z_$][\w$]*)*)\s*=\s*window\.(?P=base)\s*\|\|\s*\{\s*\}\s*\)\.(?P<key>[A-Za-z_$][\w$]*)\s*=\s*window\.(?P<right>_jibe(?:\.[A-Za-z_$][\w$]*)*)\s*\|\|\s*', source[index:])
            if fallback:
                base = fallback['base'].split('.'); target = base + [fallback['key']]
                assert fallback['right'].split('.') == target
                previous = read_path(base)
                if not truthy(previous):
                    write_path(base, {})
                literal = DataLiteral(source, index + len(fallback[0])); default = literal.value()
                previous = read_path(target); value = previous if truthy(previous) else default
                write_path(target, value); index = whitespace(source, literal.index)
                assert source[index] == ';'; index += 1
                assignments.append(dict(target=target, nativeJavaScript=source[start:index], value=copy.deepcopy(value)))
                index = whitespace(source, index); continue
            match = re.match(r'(?:window\.)?(_jibe|searchConfig)((?:\.[A-Za-z_$][\w$]*)*)\s*=\s*', source[index:])
            assert match, ('unsupported native configuration statement', source[index:index + 80])
            name = match[1]; path = [part for part in match[2].split('.') if part]
            assert not any(key in ['__proto__', 'prototype', 'constructor'] for key in path)
            index += len(match[0])
            literal = DataLiteral(source, index); value = literal.value(); index = literal.index
            index = whitespace(source, index)
            if index < len(source):
                assert source[index] == ';'; index += 1
            native = source[start:index]
            if not path:
                assert isinstance(value, dict); values[name] = copy.deepcopy(value)
            else:
                assert name in values
                at = values[name]
                for key in path[:-1]:
                    assert isinstance(at.get(key), dict); at = at[key]
                at[path[-1]] = copy.deepcopy(value)
            assignments.append(dict(target=[name] + path, nativeJavaScript=native, value=copy.deepcopy(value)))
            index = whitespace(source, index)
    return values, assignments, carriers


def page(source, url, primary=False):
    document = Document(source)
    values, assignments, carriers = declarations(document)
    result = dict(sourcePage=url, head=head(document), nativeAccount=values.get('_jibe'),
                  nativeSettings=values.get('searchConfig'), nativeConfigurationAssignments=assignments,
                  nativeConfigurationCarriers=carriers)
    if primary:
        result['nativeHandoffs'] = [dict(attrs=node['attrs'], authoredText=authored(node), url=urljoin(url, node['attrs'].get('href', ''))) for node in document.nodes if node['active'] and node['tag'] == 'a' and norm(authored(node)).upper() == 'ALL JOBS']
    else:
        result['nativeRecruitmentScripts'] = [dict(attrs=node['attrs'], url=urljoin(url, node['attrs']['src'])) for node in document.nodes if node['active'] and node['tag'] == 'script' and node['attrs'].get('src') and re.fullmatch(r'(?:|module|(?:text|application)/(?:java|ecma)script)', node['attrs'].get('type', ''), re.I) and '/prod/search/' in urlsplit(urljoin(url, node['attrs']['src'])).path]
    return result


def primary(source, url=PRIMARY):
    return page(source, url, True)


def board(source, url=BOARD):
    return page(source, url, False)
