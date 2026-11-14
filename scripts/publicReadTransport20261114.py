"""Public HTTP capture transport using the host's default TLS trust and proxy."""
import base64
import gzip
import io
import json
import sys
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


request = json.load(sys.stdin)
encoded_body = request.get('bodyBase64')
body = base64.b64decode(encoded_body, validate=True) if encoded_body is not None else None
if body is not None and len(body) > 12 * 1024 * 1024:
    raise ValueError('Public request exceeds capture limit')
req = urllib.request.Request(request['url'], data=body,
                             headers=request['headers'], method=request['method'])
opener = urllib.request.build_opener(*([NoRedirect()] if request['redirect'] in ('manual', 'error') else []))
try:
    response = opener.open(req, timeout=25)
except urllib.error.HTTPError as error:
    if (request['redirect'] == 'error' and error.code in (301, 302, 303, 307, 308)
            and error.headers.get('Location')):
        error.close()
        raise ValueError('Public request forbids redirects') from None
    response = error
with response:
    limit = 12 * 1024 * 1024
    content = response.read(limit + 1)
    if len(content) > limit:
        raise ValueError('Public response exceeds capture limit')
    wire = {}
    encoding = response.headers.get('Content-Encoding', '').strip().lower()
    if encoding in ('gzip', 'x-gzip'):
        wire = {'wireBody': base64.b64encode(content).decode('ascii'), 'wireContentEncoding': encoding}
        # urllib exposes encoded HTTP bytes; fetch exposes decoded body bytes.
        # Bound the decoded read too, including concatenated gzip members.
        with gzip.GzipFile(fileobj=io.BytesIO(content)) as decoded:
            content = decoded.read(limit + 1)
        if len(content) > limit:
            raise ValueError('Public response exceeds capture limit')
    elif encoding not in ('', 'identity'):
        raise ValueError('Unsupported public Content-Encoding: ' + encoding)
    json.dump({'status': response.code, 'url': response.url, 'headers': list(response.headers.items()),
               'body': base64.b64encode(content).decode('ascii'), **wire}, sys.stdout)
