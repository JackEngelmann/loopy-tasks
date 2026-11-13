#!/usr/bin/env python3
"""Run the tests: python3 tests/run.py [unit|e2e|server]

Serves the repo on a free local port, opens tests/index.html in headless Chrome
and prints the report; server runs serve.py's tests (tests/test_serve.py). Exits non-zero if anything failed.
Set CHROME to the browser binary if it isn't in the default macOS location.
"""
import functools
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    server_ok = True
    if only in ('', 'server'):
        server_ok = subprocess.run([sys.executable, os.path.join(ROOT, 'tests', 'test_serve.py')]).returncode == 0
        if only == 'server':
            sys.exit(0 if server_ok else 1)
    handler = functools.partial(QuietHandler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/tests/index.html' + (f'?only={only}' if only else '')

    profile = tempfile.mkdtemp(prefix='loopy-tests-')
    try:
        out = subprocess.run(
            [CHROME, '--headless=new', f'--user-data-dir={profile}', '--virtual-time-budget=120000',
             '--dump-dom', url],
            capture_output=True, text=True, timeout=180,
        ).stdout
    finally:
        shutil.rmtree(profile, ignore_errors=True)
        server.shutdown()

    match = re.search(r'<pre id="report">(.*?)</pre>', out, re.S)
    report = match.group(1) if match else 'no report: the test page did not finish'
    report = report.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&quot;', '"')
    print(report)
    sys.exit(0 if server_ok and '<title>PASS</title>' in out else 1)


if __name__ == '__main__':
    main()
