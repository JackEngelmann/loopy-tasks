#!/usr/bin/env python3
"""serve.py's guards: python3 tests/test_serve.py (tests/run.py runs it too)

Runs the server on a free port with Todoist itself replaced, so nothing leaves the machine.
"""
import http.client
import json
import os
import sys
import threading
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import serve  # noqa: E402


class FakeResponse:
    status = 200

    def __init__(self, req):
        self.req = req

    def read(self):
        return json.dumps({'results': [], 'next_cursor': None, 'url': self.req.full_url,
                           'auth': self.req.get_header('Authorization')}).encode()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        pass


class ServeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = serve.http.server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        patches = [
            mock.patch.object(serve, 'token', lambda: 'secret'),
            mock.patch.object(serve.urllib.request, 'urlopen', lambda req, timeout: FakeResponse(req)),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port)
        hs = {'Host': f'localhost:{self.port}', **(headers or {})}
        if body is not None:
            body = json.dumps(body)
            hs.setdefault('Content-Type', 'application/json')
        conn.request(method, path, body, hs)
        res = conn.getresponse()
        data = res.read()
        conn.close()
        try:
            return res.status, json.loads(data)
        except ValueError:
            return res.status, data

    def test_passes_on_loopys_requests_with_the_token(self):
        status, data = self.request('GET', '/todoist/tasks/filter?query=%40arbeit')
        self.assertEqual(status, 200)
        self.assertEqual(data['url'], 'https://api.todoist.com/api/v1/tasks/filter?query=%40arbeit')
        self.assertEqual(data['auth'], 'Bearer secret')
        self.assertEqual(self.request('POST', '/todoist/tasks', {'content': 'x', 'due_string': 'fri'})[0], 200)
        self.assertEqual(self.request('POST', '/todoist/tasks/abc123', {'due_string': 'fri'})[0], 200)

    def test_never_serves_dotfiles(self):
        for path in ['/.env', '/%2Eenv', '/.git/config', '/src/../.env']:
            self.assertEqual(self.request('GET', path)[0], 404, path)
        self.assertEqual(self.request('GET', '/index.html')[0], 200)

    def test_only_loopys_requests(self):
        self.assertEqual(self.request('GET', '/todoist/user')[0], 403)
        self.assertEqual(self.request('POST', '/todoist/tasks/abc/close', {})[0], 403)
        self.assertEqual(self.request('POST', '/todoist/projects', {'name': 'x'})[0], 403)
        status, data = self.request('POST', '/todoist/tasks/abc', {'due_string': 'fri', 'project_id': 'P'})
        self.assertEqual((status, data['error']), (403, 'Loopy does not set project_id'))
        self.assertEqual(self.request('POST', '/todoist/tasks', {'content': 'x'}, {'Content-Type': 'text/plain'})[0], 415)

    def test_only_from_loopys_pages(self):
        evil = [
            {'Origin': 'http://evil.example'},
            {'Origin': f'http://localhost:{self.port + 1}'},
            {'Sec-Fetch-Site': 'same-site'},
            {'Sec-Fetch-Site': 'cross-site'},
            {'Host': f'evil.example:{self.port}'},   # DNS rebinding
        ]
        for headers in evil:
            self.assertEqual(self.request('GET', '/todoist/projects', headers=headers)[0], 403, headers)
        same = {'Origin': f'http://localhost:{self.port}', 'Sec-Fetch-Site': 'same-origin'}
        self.assertEqual(self.request('POST', '/todoist/tasks', {'content': 'x'}, same)[0], 200)

    def test_says_when_the_token_is_missing(self):
        with mock.patch.object(serve, 'token', lambda: None):
            self.assertEqual(self.request('GET', '/todoist/projects'), (503, {'error': 'no TODOIST_TOKEN in .env'}))


class QuietHandler(serve.Handler):
    def log_message(self, *args):
        pass


if __name__ == '__main__':
    unittest.main()
