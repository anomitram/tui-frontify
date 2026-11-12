"""Pair local file links (mp4/pdf) with the hrefs the content upload produced on the published
pages, to plan where each file must be uploaded so the restored link (/assets/...<name>.<ext>)
resolves. Output migration-work/preview-publish/file-upload-plan.json [{local, target, page, size}]."""
import glob
import json
import os
import re
import subprocess
import time

REPO = '/backups/anomitram/tui-frontify/repo/content'
HOST = 'https://main--tui-frontify--anomitram.aem.page'
pat = re.compile(r'href="(/assets/[^"]+\.(?:mp4|pdf))"', re.I)
plan, unmatched = {}, []
files = sorted(glob.glob(f'{REPO}/**/*.plain.html', recursive=True))
for f in files:
    t = open(f, encoding='utf-8').read()
    loc = pat.findall(t)
    if not loc:
        continue
    page = f[len(REPO):-len('.plain.html')]
    pub = subprocess.run(['curl', '-s', f'{HOST}{page}.plain.html'], capture_output=True, text=True).stdout
    time.sleep(0.2)
    pubs = re.findall(r'href="(/assets/[^"]+-(?:mp4|pdf))"', pub, re.I)
    if not pub or 'href' not in pub:
        unmatched.append((page, 'page not published'))
    for i, l in enumerate(loc):
        slug = pubs[i] if i < len(pubs) else None
        if slug:
            target = re.sub(r'-(mp4|pdf)$', r'.\1', slug)
        else:
            # same rule the upload applies (observed): lower case, "_" and spaces to "-"
            d, n = l.rsplit('/', 1)
            target = d.lower() + '/' + re.sub(r'[^a-z0-9.]+', '-', n.lower()).strip('-')
        plan[l] = {'local': l, 'target': target, 'page': page, 'size': os.path.getsize(f'{REPO}{l}') if os.path.exists(f'{REPO}{l}') else None, 'from_published': bool(slug)}
json.dump(list(plan.values()), open('migration-work/preview-publish/file-upload-plan.json', 'w'), indent=1)
vals = list(plan.values())
print('files', len(vals), 'MB', round(sum(v['size'] or 0 for v in vals) / 1e6), 'from published', sum(v['from_published'] for v in vals), 'missing local', [v['local'] for v in vals if v['size'] is None][:3])
print('changed names', sum(1 for v in vals if v['target'] != v['local']), 'e.g.', [(v['local'], v['target']) for v in vals if v['target'] != v['local']][:3])
print('unmatched', unmatched[:5])
