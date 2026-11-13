"""Find pages whose published text differs from the local content (author edits in Document
Authoring, or a stale local copy). Compares the visible text of <host><path>.plain.html with
content/<path>.plain.html (metadata and section metadata left out; the published form has none).
Usage: python3 -I compare_published_text.py <host> <pathsFile> [contentDir=content]
"""
import difflib
import html
import re
import subprocess
import sys
import time

host, paths_file, *rest = sys.argv[1:]
content = rest[0] if rest else 'content'


def text(t):
    t = re.sub(r'<div class="(?:section-)?metadata">.*?</div>\s*</div>\s*</div>', ' ', t, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = html.unescape(t).replace('​', ' ').replace('⁠', ' ').replace(' ', ' ')
    return re.sub(r'\s+', ' ', t).strip()


changed = 0
for p in [x.strip() for x in open(paths_file) if x.strip()]:
    try:
        loc = open(f'{content}{"/index" if p == "/" else p}.plain.html', encoding='utf-8').read()
    except FileNotFoundError:
        print('NO LOCAL', p)
        continue
    pub = subprocess.run(['curl', '-s', f'{host}{p}.plain.html' if p != '/' else f'{host}/index.plain.html'], capture_output=True, text=True).stdout
    time.sleep(0.15)
    a, b = text(loc).split(' '), text(pub).split(' ')
    if a == b:
        continue
    changed += 1
    diff = [d for d in difflib.ndiff(a, b) if d[:1] in '+-']
    print('CHANGED', p, ' '.join(diff[:24])[:300])
print('pages with text differences', changed)
