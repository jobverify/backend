"""The diagnostic transport must expose the same decoded bytes as native fetch."""
import base64
import gzip
import json
from pathlib import Path
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


PAYLOAD = json.dumps({'title': 'Recruiting 系统', 'jobs': []}, ensure_ascii=False).encode('utf-8')
ENCODED = gzip.compress(PAYLOAD, mtime=0)
LIMIT = 12 * 1024 * 1024


class CompressedPublisher(BaseHTTPRequestHandler):
    def do_GET(self):
        body = gzip.compress(b'x' * (LIMIT + 1), mtime=0) if self.path == '/oversized' else ENCODED
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


class PublicReadTransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), CompressedPublisher)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def capture(self, path):
        url = f'http://127.0.0.1:{self.server.server_port}{path}'
        return subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[1] / 'scripts/publicReadTransport20261113.py')],
            input=json.dumps({'url': url, 'headers': {'Accept-Encoding': 'identity'},
                              'method': 'GET', 'redirect': 'follow'}),
            capture_output=True, text=True, timeout=15, check=False,
        )

    def test_gzip_is_decoded_even_when_publisher_ignores_identity_request(self):
        result = self.capture('/gzip')
        self.assertEqual(result.returncode, 0, result.stderr)
        packet = json.loads(result.stdout)
        self.assertEqual(base64.b64decode(packet['body']), PAYLOAD)

    def test_encoded_wire_bytes_are_retained_for_independent_verification(self):
        result = self.capture('/gzip')
        self.assertEqual(result.returncode, 0, result.stderr)
        packet = json.loads(result.stdout)
        self.assertIn('wireBody', packet)
        self.assertEqual(base64.b64decode(packet['wireBody']), ENCODED)
        self.assertEqual(packet['wireContentEncoding'], 'gzip')

    def test_decompressed_response_is_bounded(self):
        result = self.capture('/oversized')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Public response exceeds capture limit', result.stderr)


if __name__ == '__main__':
    unittest.main()
