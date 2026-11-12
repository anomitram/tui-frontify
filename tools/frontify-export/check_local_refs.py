"""Offline link and media check for migrated pages: every local href/src in
content/<prefix>**.plain.html must point at an existing page (content/<path>.plain.html) or file
(content/<path>); heading anchors (#slug) must exist on the target page (as a Styles "id:" of a
heading cell or an element id). External links are listed by host.
Usage: python3 -I check_local_refs.py <contentDir> <prefix> [<prefix> ...]   e.g. content the-mora
"""
import collections
import glob
import html
import os
import re
import sys

content, *prefixes = sys.argv[1:]
files = sorted({f for p in prefixes for f in glob.glob(f'{content}/{p}*.plain.html') + glob.glob(f'{content}/{p}/**/*.plain.html', recursive=True)})
ids_cache = {}


def page_ids(path):
    if path not in ids_cache:
        f = f'{content}{path}.plain.html'
        t = open(f, encoding='utf-8').read() if os.path.exists(f) else ''
        ids = set(re.findall(r'\bid:\s*([\w-]+)', t)) | set(re.findall(r'\bid="([^"]+)"', t))
        ids_cache[path] = ids
    return ids_cache[path]


broken = []
external = collections.Counter()
checked = 0
for f in files:
    page = f[len(content):-len('.plain.html')]
    t = open(f, encoding='utf-8').read()
    refs = [('href', html.unescape(h)) for h in re.findall(r'href="([^"]+)"', t)]
    refs += [('src', html.unescape(s)) for s in re.findall(r'\ssrc="([^"]+)"', t)]
    # links written as text (cards grid link cells) are hrefs too
    refs += [('href', h) for h in re.findall(r'<div>(/[\w/-]+(?:#[\w-]+)?)</div>', t)]
    for kind, u in refs:
        if u.startswith(('mailto:', 'tel:')):
            continue
        if re.match(r'https?://', u):
            external[re.match(r'https?://([^/]+)', u).group(1)] += 1
            continue
        checked += 1
        path, _, frag = u.partition('#')
        path = path.split('?')[0]
        if not path:
            path = page
        if re.search(r'\.\w{2,5}$', path):
            ok = os.path.exists(f'{content}{path}')
        else:
            ok = os.path.exists(f'{content}{path}.plain.html') or os.path.exists(f'{content}{path}/index.plain.html') or path == '/'
        if not ok:
            broken.append((page, kind, u, 'missing target'))
        elif frag and not re.search(r'\.\w{2,5}$', path) and frag not in page_ids(path):
            broken.append((page, kind, u, 'missing anchor'))
print('pages', len(files), 'local refs checked', checked, 'broken', len(broken))
for b in broken[:60]:
    print('  ', *b)
print('external hosts', dict(external))
