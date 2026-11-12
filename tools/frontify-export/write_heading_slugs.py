"""Write scripts/guideline-slugs.json: the original Frontify heading slugs per migrated page path, in
page order. The sidebar document's heading links carry them as "#slug", but the content pipeline drops
the "#..." part of same-site links when publishing, so scripts/guideline.js falls back to this file.
Re-run after a new export of a document. Several documents go into one file; each navigation.json
can carry a path prefix ("<navigation.json>=<prefix>", e.g. ...1887/raw/navigation.json=/the-mora/brand;
doc 396 has none).
Usage: python3 -I write_heading_slugs.py <out.json> <navigation.json>[=<prefix>] [...]
       (old form, one document without prefix: write_heading_slugs.py <navigation.json> <out.json>)
"""
import json
import sys

args = sys.argv[1:]
if len(args) == 2 and args[0].endswith('navigation.json') and not args[1].endswith('navigation.json'):
    args = [args[1], args[0]]  # old argument order
out_file, *navs = args
out = {}
for spec in navs:
    nav_file, _, prefix = spec.partition('=')
    nav = json.load(open(nav_file))['data']
    for c in nav:
        ct = c['translations']['default']
        pages = [k for k in c.get('children', []) if k['type'] == 'page'] if c['type'] == 'page_category' else [c]
        for p in pages:
            pt = p['translations']['default']
            path = f"{prefix}/{ct['slug']}/{pt['slug']}" if c['type'] == 'page_category' else f"{prefix}/{pt['slug']}"
            heads = [[h['translations']['default']['title'], h['translations']['default']['slug']]
                     for h in p.get('children', []) if h['type'] == 'page_heading']
            if heads:
                out[path] = heads
json.dump(out, open(out_file, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'pages,', sum(len(v) for v in out.values()), 'headings ->', out_file)
