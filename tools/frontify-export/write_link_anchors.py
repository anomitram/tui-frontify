"""Write scripts/link-anchors.json: in-content links to a heading of a migrated page ("/path#slug").
The content upload drops the "#slug" of same-site links, so scripts/guideline.js puts it back from
this list: {page path: [[link text, target path, slug], ...]} in page order. Sidebars, navs and
footers are left out (their heading links are restored from guideline-slugs.json).
Usage: python3 -I write_link_anchors.py <contentDir> <out.json> [<path prefix> ...]
"""
import glob
import html
import json
import re
import sys

content, out, *prefixes = sys.argv[1:]
result = {}
for f in sorted(glob.glob(f'{content}/**/*.plain.html', recursive=True)):
    page = f[len(content):-len('.plain.html')]
    if re.search(r'/(sidebar|nav|footer)$', page) or (prefixes and not page.startswith(tuple(prefixes))):
        continue
    t = open(f, encoding='utf-8').read()
    links = []
    for m in re.finditer(r'<a [^>]*href="(/[^"#]*)#([^"]+)"[^>]*>(.*?)</a>', t, flags=re.S):
        text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', m.group(3)))).strip()
        links.append([text, m.group(1).rstrip('/') or '/', html.unescape(m.group(2))])
    if links:
        result[page] = links
json.dump(result, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(result), 'pages,', sum(len(v) for v in result.values()), 'links ->', out)
