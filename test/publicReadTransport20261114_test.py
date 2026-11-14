"""The versioned capture transport must preserve encoded request bytes."""
import base64
import json
from pathlib import Path
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import publicReadTransport_test as legacy


class EchoPublisher(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(302 if self.path == '/redirect' else 200)
        if self.path == '/redirect':
            self.send_header('Location', '/ok')
        self.end_headers()
        self.wfile.write(b'native response')

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        payload = json.dumps({'body': base64.b64encode(body).decode('ascii'),
                              'contentType': self.headers.get('Content-Type')}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_args):
        pass


class PublicReadTransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), EchoPublisher)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def capture(self, body):
        return subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[1] / 'scripts/publicReadTransport20261114.py')],
            input=json.dumps({'url': f'http://127.0.0.1:{self.server.server_port}/jobs/search',
                              'method': 'POST', 'headers': {'Content-Type': 'multipart/form-data; boundary=proof'},
                              'bodyBase64': base64.b64encode(body).decode('ascii'), 'redirect': 'follow'}),
            capture_output=True, text=True, timeout=15, check=False)

    def test_binary_and_unicode_request_bytes_survive(self):
        body = b'--proof\r\n' + 'India \u7cfb\u7edf'.encode('utf-8') + b'\x00\x80\xff\r\n--proof--\r\n'
        result = self.capture(body)
        self.assertEqual(result.returncode, 0, result.stderr)
        response = json.loads(base64.b64decode(json.loads(result.stdout)['body']))
        self.assertEqual(base64.b64decode(response['body']), body)
        self.assertEqual(response['contentType'], 'multipart/form-data; boundary=proof')

    def test_redirect_error_policy_never_follows_a_redirect(self):
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[1] / 'scripts/publicReadTransport20261114.py')],
            input=json.dumps({'url': f'http://127.0.0.1:{self.server.server_port}/redirect',
                              'method': 'GET', 'headers': {}, 'bodyBase64': None, 'redirect': 'error'}),
            capture_output=True, text=True, timeout=15, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('forbids redirects', result.stderr)


class GzipResponseTests(legacy.PublicReadTransportTests):
    def capture(self, path):
        return subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[1] / 'scripts/publicReadTransport20261114.py')],
            input=json.dumps({'url': f'http://127.0.0.1:{self.server.server_port}{path}',
                              'method': 'GET', 'headers': {'Accept-Encoding': 'identity'},
                              'bodyBase64': None, 'redirect': 'follow'}),
            capture_output=True, text=True, timeout=15, check=False)


if __name__ == '__main__':
    unittest.main()
