#!/usr/bin/env python3
"""Serve Loopy on this machine only and pass its Todoist requests on: python3 serve.py [port]

The Todoist token is read from TODOIST_TOKEN in .env (or the environment) and never
reaches the browser. Only the requests Loopy makes are passed on, and only from
Loopy's own pages, so another page can't use the token either.
"""
import http.server
import json
import os
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
API = 'https://api.todoist.com/api/v1/'

# what Loopy may ask of Todoist: method, path, and the fields a POST may set
ALLOWED = [
    ('GET', re.compile(r'tasks/filter'), None),                   # a, :pick
    ('GET', re.compile(r'projects'), None),                       # project names in the list
    ('POST', re.compile(r'tasks'),                                # :park, a new task
     {'content', 'description', 'priority', 'due_string'}),
    ('POST', re.compile(r'tasks/[\w-]+'), {'due_string'}),        # :park on a picked task, a new date
]


def token():
    if os.environ.get('TODOIST_TOKEN'):
        return os.environ['TODOIST_TOKEN']
    try:
        with open(os.path.join(ROOT, '.env')) as f:
            for line in f:
                key, sep, value = line.strip().partition('=')
                if sep and key.strip() == 'TODOIST_TOKEN':
                    return value.strip().strip('"\'') or None
    except FileNotFoundError:
        pass
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # dotfiles (.env, .git) are never served
    def send_head(self):
        if any(p.startswith('.') for p in unquote(urlsplit(self.path).path).split('/') if p):
            self.send_error(404)
            return None
        return super().send_head()

    def do_GET(self):
        if self.path.startswith('/todoist/'):
            return self.todoist('GET')
        super().do_GET()

    def do_POST(self):
        if self.path.startswith('/todoist/'):
            return self.todoist('POST')
        self.send_error(405)

    # only Loopy's own pages: the right Host (no DNS rebinding), and no other origin,
    # including other localhost ports, which browsers count as the same site
    def from_loopy(self):
        port = self.server.server_address[1]
        host = self.headers.get('Host', '')
        if host not in (f'127.0.0.1:{port}', f'localhost:{port}'):
            return False
        origin = self.headers.get('Origin')
        if origin and origin != f'http://{host}':
            return False
        return self.headers.get('Sec-Fetch-Site', 'same-origin') in ('same-origin', 'none')

    def todoist(self, method):
        if not self.from_loopy():
            return self.reply(403, {'error': 'only Loopy may use this'})
        url = urlsplit(self.path)
        path = url.path[len('/todoist/'):]
        rule = next((r for r in ALLOWED if r[0] == method and r[1].fullmatch(path)), None)
        if not rule:
            return self.reply(403, {'error': f'Loopy does not pass on {method} {path}'})

        body = None
        if method == 'POST':
            if self.headers.get('Content-Type') != 'application/json':
                return self.reply(415, {'error': 'expected JSON'})
            try:
                data = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
            except ValueError:
                return self.reply(400, {'error': 'not JSON'})
            if not isinstance(data, dict) or set(data) - rule[2]:
                return self.reply(403, {'error': f'Loopy does not set {", ".join(sorted(set(data) - rule[2]))}'})
            body = json.dumps(data).encode()

        tok = token()
        if not tok:
            return self.reply(503, {'error': 'no TODOIST_TOKEN in .env'})
        headers = {'Authorization': f'Bearer {tok}'}
        if body:
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(API + path + (f'?{url.query}' if url.query else ''),
                                     data=body, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                status, payload = res.status, res.read()
        except urllib.error.HTTPError as err:
            status, payload = err.code, err.read()
        except urllib.error.URLError as err:
            return self.reply(502, {'error': f'could not reach Todoist ({err.reason})'})
        self.send_raw(status, payload)

    def reply(self, status, data):
        self.send_raw(status, json.dumps(data).encode())

    def send_raw(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'Loopy on http://localhost:{port}' + ('' if token() else ' (no TODOIST_TOKEN in .env yet)'))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
