"""Public HTTP capture transport using the host's default TLS trust and proxy."""
import base64
import json
import sys
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


request = json.load(sys.stdin)
body = request.get('body')
req = urllib.request.Request(request['url'], data=body.encode() if body is not None else None,
                             headers=request['headers'], method=request['method'])
opener = urllib.request.build_opener(*([NoRedirect()] if request['redirect'] == 'manual' else []))
try:
    response = opener.open(req, timeout=25)
except urllib.error.HTTPError as error:
    response = error
with response:
    content = response.read(12 * 1024 * 1024 + 1)
    if len(content) > 12 * 1024 * 1024:
        raise ValueError('Public response exceeds capture limit')
    json.dump({'status': response.code, 'url': response.url, 'headers': list(response.headers.items()),
               'body': base64.b64encode(content).decode('ascii')}, sys.stdout)
