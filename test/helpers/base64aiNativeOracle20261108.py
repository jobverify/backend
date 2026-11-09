"""Repository independent oracle; public HTML is data, no report-directory I/O.
Original parser source SHA256 4f72f4891a7161a9f75a3b1da4bbaa4b72c6518d92f39f12539a29259b13c9a9.
"""
"""Independent original-byte Base64.ai models. Publisher programs are data."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, parse_qs
import json, re, gzip, base64, hashlib, copy

PRIMARY = 'https://base64.ai/careers/'
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
FOREIGN = {'svg', 'math', 'template', 'noscript', 'object'}


def norm(value):
    return ' '.join(value.split())


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source; self.lines = [0]
        self.lines.extend(match.end() for match in re.finditer('\n', source))
        self.root = dict(tag='root', attrs={}, children=[], parent=None, active=True)
        self.stack = [self.root]; self.nodes = []
        self.feed(source)

    def source_offset(self):
        line, column = self.getpos()
        return self.lines[line - 1] + column

    def handle_starttag(self, tag, attributes):
        parent = self.stack[-1]; attrs = {}
        for key, value in attributes:
            if key not in attrs: attrs[key] = '' if value is None else value
        style = re.sub(r'/\*.*?\*/', '', attrs.get('style', ''), flags=re.S)
        hidden = any(key in attrs for key in ['hidden', 'inert']) or attrs.get('aria-hidden', '').lower() == 'true' or re.search(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)', style, re.I)
        start = self.source_offset(); opening = self.get_starttag_text()
        node = dict(tag=tag, attrs=attrs, children=[], parent=parent, active=bool(parent['active'] and not hidden and tag not in FOREIGN), start=start, openEnd=start + len(opening), end=None, closeStart=None)
        self.nodes.append(node); parent['children'].append(node)
        if tag in VOID:
            node['end'] = node['openEnd']; node['closeStart'] = node['openEnd']
        else:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and any(node['tag'] in ['svg', 'math'] for node in self.stack):
            node = self.stack.pop(); node['end'] = node['openEnd']; node['closeStart'] = node['openEnd']

    def handle_endtag(self, tag):
        index = next((i for i in range(len(self.stack) - 1, 0, -1) if self.stack[i]['tag'] == tag), None)
        if index is not None:
            node = self.stack[index]; node['closeStart'] = self.source_offset()
            end = self.source.find('>', node['closeStart'])
            node['end'] = end + 1 if end >= 0 else None
            del self.stack[index:]

    def handle_data(self, value):
        self.stack[-1]['children'].append(value)

    def outer(self, node):
        return self.source[node['start']:node['end']] if node['end'] is not None else None

    def inner(self, node):
        return self.source[node['openEnd']:node['closeStart']] if node['closeStart'] is not None else None


def authored(node):
    if isinstance(node, str): return node
    if not node['active'] or node['tag'] in ['script', 'style', 'template', 'noscript']: return ''
    return norm(' '.join(authored(child) for child in node['children']))


def cls(node, value):
    return value in node['attrs'].get('class', '').split()


def beneath(node, parent):
    while node is not None:
        if node is parent: return True
        node = node['parent']
    return False


def original_model(source, url=PRIMARY):
    document = Document(source)
    active = [node for node in document.nodes if node['active']]
    heads = [node for node in active if node['parent']['tag'] == 'head']
    head = dict(titles=[authored(node) for node in heads if node['tag'] == 'title'], canonicals=[node['attrs'].get('href') for node in heads if node['tag'] == 'link' and 'canonical' in node['attrs'].get('rel', '').split()], metas=[node['attrs'] for node in heads if node['tag'] == 'meta'])
    sections = [node for node in active if node['tag'] == 'section' and cls(node, 'careers-simple')]
    records = []
    for node in active:
        if not cls(node, 'job-item'): continue
        summaries = [child for child in node['children'] if isinstance(child, dict) and child['active'] and child['tag'] == 'summary']
        contents = [child for child in node['children'] if isinstance(child, dict) and child['active'] and cls(child, 'job-content')]
        content = contents[0] if len(contents) == 1 else None
        metadata = [child for child in content['children'] if isinstance(child, dict) and child['active'] and child['tag'] == 'div' and cls(child, 'meta')] if content else []
        fields = [child for child in metadata[0]['children'] if isinstance(child, dict) and child['active'] and child['tag'] == 'p'] if len(metadata) == 1 else []
        types = [match[1] for child in fields if (match := re.fullmatch(r'Type:\s*(.+)', authored(child)))]
        locations = [match[1] for child in fields if (match := re.fullmatch(r'Location:\s*(.+)', authored(child)))]
        employment = types[0] if len(types) == 1 else None
        location = locations[0] if len(locations) == 1 else None
        records.append(dict(nativeTag=node['tag'], nativeAttributes=node['attrs'], nativeRoleHTML=document.outer(node), nativeSectionOrdinal=next((i for i, section in enumerate(sections) if beneath(node, section)), None),
            nativeSummaries=[dict(attrs=x['attrs'], text=authored(x), nativeHTML=document.outer(x)) for x in summaries],
            nativeContentCount=len(contents), nativeContentAttributes=content['attrs'] if content else None, nativeContentHTML=document.inner(content) if content else None, nativeContentText=authored(content) if content else None,
            nativeMetadataCarriers=[dict(attrs=x['attrs'], text=authored(x), nativeHTML=document.outer(x)) for x in metadata], nativeEmploymentType=employment, nativeLocation=location,
            nativeApplications=[dict(attrs=x['attrs'], text=authored(x), nativeHTML=document.outer(x)) for x in active if content and beneath(x, content) and x['tag'] == 'a' and cls(x, 'apply-link')]))
    return dict(sourcePage=url, nativeDocumentHTML=source, head=head, nativeBases=[x['attrs'] for x in heads if x['tag'] == 'base'],
        nativeH1=[authored(x) for x in active if x['tag'] == 'h1'], nativeSections=[dict(attrs=x['attrs'], nativeHTML=document.outer(x), headings=[authored(y) for y in active if y['tag'] == 'h2' and beneath(y, x)]) for x in sections],
        nativeRecruitmentLinks=[dict(attrs=x['attrs'], text=authored(x), url=urljoin(url, x['attrs'].get('href', ''))) for x in active if x['tag'] == 'a' and (authored(x) == 'Careers' or re.search(r'/(?:careers|jobs)(?:/|$)', x['attrs'].get('href', '')))], nativeRoles=records)


def own_page_bound(model):
    def own_url(value):
        url=urlsplit(urljoin(PRIMARY,value))
        return url.scheme=='https' and url.hostname=='base64.ai' and url.port in [None,443] and url.username is None and url.password is None and not url.query and not url.fragment and url.path.rstrip('/')=='/careers'
    try:
        head=model['head'];og=[x for x in head['metas'] if x.get('property')=='og:url'];names=[x for x in head['metas'] if x.get('property')=='og:site_name']
        return model['sourcePage']==PRIMARY and head['titles']==['Careers | Base64.ai: AI-Powered Document Intelligence'] and len(head['canonicals'])==1 and own_url(head['canonicals'][0]) and all(own_url(x.get('content')) for x in og) and len(names)==1 and names[0].get('content')=='Base64.ai: AI-Powered Document Intelligence' and all(own_url(x.get('href')) for x in model['nativeBases']) and model['nativeH1']==['Careers'] and len(model['nativeSections'])==1 and model['nativeSections'][0]['headings']==['Open Roles'] and model['nativeSections'][0]['nativeHTML'] is not None and bool(model['nativeRecruitmentLinks']) and all(own_url(x['url']) for x in model['nativeRecruitmentLinks']) and len(model['nativeRoles'])<=500
    except (KeyError,TypeError,ValueError,AttributeError):
        return False


def qualification(model, role):
    title = role['nativeSummaries'][0]['text'] if len(role['nativeSummaries']) == 1 else None
    apps = role['nativeApplications']; mailbox = None; subject = None
    if len(apps) == 1:
        url = urlsplit(apps[0]['attrs'].get('href', '')); query = parse_qs(url.query, keep_blank_values=True)
        if url.scheme == 'mailto' and not url.netloc and not url.fragment and url.path == 'careers@base64.ai' and set(query) <= {'subject', 'body'} and len(query.get('subject', [])) == 1 and len(query.get('body', [''])) == 1:
            mailbox = url.path; subject = query['subject'][0]
    identity = own_page_bound(model) and role['nativeTag'] == 'details' and role['nativeSectionOrdinal'] == 0 and bool(title) and subject == 'Application for ' + title and mailbox == 'careers@base64.ai' and 'Base64.ai' in (role['nativeContentText'] or '')
    raw = role['nativeLocation']; country = None
    if isinstance(raw, str):
        country = {'Türkiye': 'Turkey', 'Turkey': 'Turkey', 'United States of America': 'United States', 'United States': 'United States', 'India': 'India'}.get(re.sub(r'\s+\(Remote\)$', '', raw))
    criteria = isinstance(role['nativeRoleHTML'], str) and role['nativeContentCount'] == 1 and isinstance(role['nativeContentHTML'], str) and len(role['nativeContentText'] or '') >= 100
    publication = not any(re.search(r'(?:^|[-_])(?:status|expiry|expires|expiration|deadline|posted|validthrough|valid-through|date|closed|archived)(?:$|[-_])', key, re.I) for key in role['nativeAttributes']) and not any(re.search(r'(?:^|\s)(?:Status|Expiry|Expires|Deadline|Posted(?: on)?|Valid through|Closing date):', item['text'], re.I) for item in role['nativeMetadataCarriers'])
    return dict(title=title, nativePostingID=None, nativePostedDate=None, nativeExpiryDate=None, nativeApplicationSubject=subject, nativeApplicationMailbox=mailbox, identityBound=bool(identity), country=country, ownCountryKnown=country is not None, fullCriteriaComplete=bool(criteria), qualified=bool(identity and criteria and publication and country is not None))


def closing_profile(model):
    return {key: value for key, value in model.items() if key != 'nativeDocumentHTML'}


def closing_models_match(opening, closing):
    left=copy.deepcopy(closing_profile(opening)); right=copy.deepcopy(closing_profile(closing))
    if left==right:return True
    a=[x for x in left['head']['metas'] if x.get('name')=='generator']; b=[x for x in right['head']['metas'] if x.get('name')=='generator']
    allowed={'WordPress 7.1.3','WordPress 7.1.4'}
    if len(a)!=1 or len(b)!=1 or a[0].get('content') not in allowed or b[0].get('content') not in allowed:return False
    a[0]['content']=b[0]['content']='<observed-generator-version>'
    return left==right


