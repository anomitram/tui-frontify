"""Map oversized local images to the image copies Document Authoring stores for each page.

Matches by image order on the page (local .plain.html vs the DA source HTML) and checks the
file names agree. Read-only against DA. Writes migration-work/frontify/resized/da-map.json.
Usage: python3 -I da_image_map.py
"""
import json
import os
import re
import subprocess
import tempfile

ORG, SITE = 'anomitram', 'tui-frontify'
log = json.load(open('migration-work/frontify/resized/resize-log.json'))
resized = {r['path']: r for r in log if r['under_target']}
pages = ['logo/live-happy-1', 'photography/captures-from-a-detail', 'photography/captures-from-a-human-perspective-1',
         'photography/capturing-multiple-perspectives-1', 'sales-mechanics/inspiration-2', 'smile-mechanics/hero-smile-1']
out = []
for p in pages:
    local = re.findall(r'<img[^>]+src="([^"]+)"', open(f'content/{p}.plain.html', encoding='utf-8').read())
    with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as t:
        tmp = t.name
    code = subprocess.run(['curl', '-sS', '-o', tmp, '-w', '%{http_code}', f'https://admin.da.live/source/{ORG}/{SITE}/{p}.html'],
                          capture_output=True, text=True).stdout
    da = re.findall(r'<img[^>]+src="([^"]+)"', open(tmp, encoding='utf-8').read()) if code == '200' else []
    os.unlink(tmp)
    for i, s in enumerate(local):
        if s not in resized:
            continue
        da_url = da[i] if i < len(da) else None
        stem = re.sub(r'[^a-z0-9]+', '-', os.path.splitext(os.path.basename(s))[0].lower()).strip('-')
        name_ok = bool(da_url) and os.path.basename(da_url).startswith(stem)
        prefix = f'https://content.da.live/{ORG}/{SITE}/'
        out.append({'page': p, 'image_index': i + 1, 'local': s, 'resized': resized[s]['resized'],
                    'da_url': da_url, 'da_source_path': da_url[len(prefix):] if da_url and da_url.startswith(prefix) else None,
                    'name_matches': name_ok, 'local_images': len(local), 'da_images': len(da), 'http': code})
json.dump(out, open('migration-work/frontify/resized/da-map.json', 'w'), indent=1)
for o in out:
    print(o['page'], '| image', o['image_index'], '|', o['da_source_path'], '| name ok' if o['name_matches'] else '| NAME MISMATCH', '| counts', o['local_images'], o['da_images'])
print(len(out), 'mapped')
