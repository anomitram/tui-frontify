"""Write a compact site map (navigation order, page ids, new paths, titles, heading counts) from
the exported Frontify navigation. Re-run after a new export.
Usage: python3 -I write_sitemap.py <navigation.json> <out.md>
"""
import datetime
import json
import sys

nav = json.load(open(sys.argv[1]))['data']
lines = [f"# Site map: Frontify document 396 (generated {datetime.date.today()} from {sys.argv[1]})", '',
         'Order = Frontify navigation order = pagination order. Path = migrated EDS path. H = page headings (sidebar anchors).', '',
         '| # | page id | path | title | H |', '|---|---|---|---|---|']
n = 0
for c in nav:
    t = c['translations']['default']
    if c['type'] == 'page_category':
        lines.append(f"| | | **{t['title']}** (category {c['id']}, slug `{t['slug']}`) | | |")
        kids = [k for k in c.get('children', []) if k['type'] == 'page']
    else:
        kids = [c]
        t = {'slug': None}
    for k in kids:
        n += 1
        kt = k['translations']['default']
        path = f"/{t['slug']}/{kt['slug']}" if t.get('slug') else f"/{kt['slug']}"
        heads = sum(1 for h in k.get('children', []) if h['type'] == 'page_heading')
        lines.append(f"| {n} | {k['id']} | `{path}` | {kt['title'] or '(untitled, hidden in sidebar)'} | {heads} |")
lines.append('')
lines.append(f'{n} pages.')
open(sys.argv[2], 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print(n, 'pages written to', sys.argv[2])
