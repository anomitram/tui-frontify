"""Verify a migrated Frontify hub page against its export (offline).

Checks: every grid row and cell present (by Frontify cell id) with matching text, assets present
with matching checksums (manifest vs export vs published copy), outgoing links resolved and listed,
no runtime dependency on Frontify hosts. Writes <hubDir>/verification.json.
Usage: python3 -I verify_hub.py <repoDir> <hubDir> <route>
"""
import collections
import hashlib
import html
import json
import os
import re
import sys

repo, hub, route = sys.argv[1:4]
C = os.path.join(repo, 'content')
grid = json.load(open(os.path.join(hub, 'raw', 'grid.json')))['rows']
manifest = json.load(open(os.path.join(hub, 'assets', 'manifest.json')))
linkmap = json.load(open(os.path.join(hub, 'link-map.json')))
_names = os.path.join(hub, 'image-names.generated.json')
NAMES = json.load(open(_names)) if os.path.exists(_names) else {}
# PAGE_PATH as in build-hub-sources.mjs (e.g. /index for the site root); default /<route>
PAGE = os.environ.get('PAGE_PATH', f'/{route}').lstrip('/')
page = open(os.path.join(C, f'{PAGE}.plain.html'), encoding='utf-8').read()
nav = open(os.path.join(C, route, 'nav.plain.html'), encoding='utf-8').read()
WORD = re.compile(r"[0-9A-Za-zÀ-ÿ’'&]+")


def words(t):
    t = html.unescape(re.sub(r'<[^>]+>', ' ', t)).replace('﻿', '').replace('​', '')
    return [w.lower() for w in WORD.findall(t)]


# split migrated page into blocks by their "Frontify Cell" marker
cells_out = {}
for m in re.finditer(r'<div class="(hub-cell|hub-divider)[^"]*">(.*?)<div><div>Frontify Cell</div><div>(\d+) \(row (\d+), sort (\d+)\)</div></div></div>', page, re.S):
    cells_out[int(m.group(3))] = {'type': m.group(1), 'html': m.group(2), 'row': int(m.group(4))}
sections_out = [int(x) for x in re.findall(r'<div><div>Row</div><div>(\d+)</div></div>', page)]

rows = sorted(grid.values(), key=lambda r: min(c['sort'] for c in r['data'].values()))
rep_rows = []
cell_total = cell_ok = text_ok = 0
for r in rows:
    rr = {'row': r['id'], 'section_present': r['id'] in sections_out, 'cells': []}
    for k, c in sorted(r['data'].items()):
        cell_total += 1
        s = c.get('settings') or {}
        src_w = words(s.get('content') or '')
        out = cells_out.get(c['teaser'])
        if c['block_type'] == 'NONE':
            present = True  # editor placeholder: no content; kept as empty row (section present)
            out_w = []
        else:
            present = out is not None
            out_w = words(out['html']) if out else []
        missing = collections.Counter(src_w) - collections.Counter(out_w)
        ok_text = present and not missing
        cell_ok += present
        text_ok += ok_text
        rr['cells'].append({'cell': k, 'teaser': c['teaser'], 'type': c['block_type'], 'width': c['width'], 'present': present,
                            'text_match': ok_text, 'missing_words': dict(missing)})
    rep_rows.append(rr)

# assets
asset_rep = {'files': 0, 'bytes': 0, 'sha_ok': 0, 'source_checksum_verified': 0, 'size_verified': 0, 'published_ok': 0, 'not_downloadable': [], 'problems': []}
for m in manifest:
    if not m.get('file'):
        asset_rep['not_downloadable'].append({'key': m['key'], 'note': m.get('note') or m.get('error')})
        continue
    f = os.path.join(hub, 'assets', m['file'])
    data = open(f, 'rb').read()
    asset_rep['files'] += 1
    asset_rep['bytes'] += len(data)
    sha = hashlib.sha256(data).hexdigest()
    if sha == m['sha256']:
        asset_rep['sha_ok'] += 1
    else:
        asset_rep['problems'].append(f"{m['key']}: sha256 mismatch")
    if m.get('checksum_verified') is True:
        asset_rep['source_checksum_verified'] += 1
    if m.get('size_verified') is True:
        asset_rep['size_verified'] += 1
    if m['kind'] != 'font':
        # descriptive names (image-names.generated.json from build-hub-sources.mjs) or the old
        # /assets/<key>/<file name> layout
        named = NAMES.get(m['key'])
        if named:
            rel = named['path']
        else:
            rel = f"/assets/{m['key']}/" + re.sub(r'[^\w.\-]+', '_', re.sub(r'\s+', '-', os.path.basename(m['file'])))
        pub = os.path.join(C, rel.lstrip('/'))
        if named and named.get('crop'):
            ok = os.path.exists(pub)  # cropped like Frontify shows it, so the bytes differ from the original
            if ok:
                asset_rep['published_cropped'] = asset_rep.get('published_cropped', 0) + 1
        else:
            ok = os.path.exists(pub) and hashlib.sha256(open(pub, 'rb').read()).hexdigest() == sha
        if ok:
            asset_rep['published_ok'] += 1
        else:
            asset_rep['problems'].append(f"{m['key']}: published copy missing/different")
        if rel not in page + nav:
            asset_rep['problems'].append(f"{m['key']}: not referenced by the migrated page")

# links + runtime deps
hrefs = re.findall(r'href="([^"]+)"', page + nav)
unresolved = [h for h in hrefs if '/r/' in h]
srcs = re.findall(r'src="([^"]+)"', page + nav)
runtime = [s for s in srcs if re.search(r'tui-brandhub\.com|frontify|ffycdn|amazonaws', s)]
missing_media = [s for s in srcs if s.startswith('/assets/') and not os.path.exists(os.path.join(C, s.lstrip('/')))]
code_deps = []
for root in ('blocks/hub-cell', 'blocks/hub-divider', 'scripts', 'styles'):
    for dp, _, fs in os.walk(os.path.join(repo, root)):
        for fn in fs:
            if fn.endswith(('.js', '.css')):
                t = open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read()
                for mm in re.finditer(r'(url\(|src=|import\s|fetch\()[^)\n]*(tui-brandhub\.com|frontify\.com|frontify-artifacts|ffycdn)', t):
                    code_deps.append(f'{root}/{fn}: {mm.group(0)[:80]}')

summary = {
    'rows_total': len(rows), 'rows_present': sum(1 for r in rep_rows if r['section_present']),
    'cells_total': cell_total, 'cells_present': cell_ok, 'cells_text_match': text_ok,
    'assets': {k: v for k, v in asset_rep.items() if k not in ('problems', 'not_downloadable')},
    'asset_problems': asset_rep['problems'], 'not_downloadable': asset_rep['not_downloadable'],
    'links_listed': len(linkmap), 'links_unresolved_r': len(unresolved), 'runtime_dependencies': runtime + code_deps,
    'missing_media': missing_media,
}
json.dump({'summary': summary, 'rows': rep_rows}, open(os.path.join(hub, 'verification.json'), 'w'), indent=1)
print(json.dumps(summary, indent=1))
for r in rep_rows:
    for c in r['cells']:
        if not c['text_match']:
            print('CELL', r['row'], c)
