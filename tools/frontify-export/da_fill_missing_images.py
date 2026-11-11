"""Map the image URLs a DA page references (in document order) to local image files (same order in
content/<page>.plain.html) and report which DA targets are missing. Read-only; writes a plan JSON.
Usage: python3 -I da_fill_missing_images.py <org> <repo> <out.json> <page> [<page> ...]
"""
import json
import os
import re
import subprocess
import sys
from urllib.parse import unquote

org, repo, out, *pages = sys.argv[1:]
plan = []
for page in pages:
    da_html = subprocess.run(['curl', '-sS', f'https://admin.da.live/source/{org}/{repo}/{page}.html'], capture_output=True, text=True).stdout
    da_srcs = re.findall(r'<img[^>]+src="([^"]+)"', da_html)
    local_html = open(f'content/{page}.plain.html', encoding='utf-8').read()
    local_srcs = re.findall(r'<img[^>]+src="([^"]+)"', local_html)
    if len(da_srcs) != len(local_srcs):
        print('COUNT MISMATCH', page, len(da_srcs), len(local_srcs))
    for i, (d, l) in enumerate(zip(da_srcs, local_srcs)):
        rel = re.sub(r'^https://content\.da\.live/[^/]+/[^/]+/', '', l)
        local_file = os.path.join('content', unquote(rel.lstrip('/')))
        target = re.sub(r'^https://content\.da\.live/[^/]+/[^/]+/', '', d)
        stem_da = os.path.basename(target).rsplit('-', 1)[0]
        stem_local = re.sub(r'[^a-z0-9]+', '-', os.path.splitext(os.path.basename(local_file))[0].lower()).strip('-')
        code = subprocess.run(['curl', '-sS', '-o', '/dev/null', '-w', '%{http_code}', f'https://admin.da.live/source/{org}/{repo}/{target}'], capture_output=True, text=True).stdout
        rec = {'page': page, 'index': i + 1, 'da_target': target, 'local_file': local_file, 'exists_locally': os.path.exists(local_file),
               'name_match': stem_da == stem_local, 'da_status': code}
        plan.append(rec)
        print(rec['page'], rec['index'], rec['da_status'], 'name ok' if rec['name_match'] else 'NAME MISMATCH', target, '<-', local_file)
json.dump(plan, open(out, 'w'), indent=1)
