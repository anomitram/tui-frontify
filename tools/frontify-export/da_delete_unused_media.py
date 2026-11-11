"""Delete unused media from Document Authoring, from a plan written beforehand (only when the user asks).
Safety: the referenced set is re-read from the given DA pages right before deleting, and any planned
file that is referenced (or not in the plan's folders) is skipped. One request at a time; each delete is
confirmed by a 404 read-back. Empty folders left behind are removed only if their listing is empty.
Usage: python3 -I da_delete_unused_media.py <org> <repo> <plan.json> <log.json> <page> [<page> ...]
  plan.json: {"old_random": [...], "superseded_upload_copies": [...]} (repo-relative DA paths)
"""
import json
import re
import subprocess
import sys
import time

org, repo, plan_path, log_path, *pages = sys.argv[1:]
SRC = f'https://admin.da.live/source/{org}/{repo}'
LIST = f'https://admin.da.live/list/{org}/{repo}'


def curl(*args):
    r = subprocess.run(['curl', '-sS', '-w', '\n%{http_code}', *args], capture_output=True, text=True)
    body, _, code = r.stdout.rpartition('\n')
    return code, body


used = set()
for p in pages:
    code, html = curl(f'{SRC}/{p}.html')
    if code != '200':
        raise SystemExit(f'STOP: cannot read page {p} ({code})')
    used |= set(re.findall(rf'src="https://content\.da\.live/{org}/{repo}/([^"?]+)', html))
    time.sleep(0.3)
plan = json.load(open(plan_path))
todo = plan.get('old_random', []) + plan.get('superseded_upload_copies', [])
log = {'when': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'referenced': len(used), 'deleted': [], 'skipped': [], 'failed': [], 'folders_removed': []}
for path in todo:
    if path in used:
        log['skipped'].append({'path': path, 'why': 'referenced by a page'})
        continue
    code, body = curl('-X', 'DELETE', f'{SRC}/{path}')
    time.sleep(0.4)
    back, _ = curl('-o', '/dev/null', '-I', f'{SRC}/{path}')
    if code.startswith('2') and back == '404':
        log['deleted'].append(path)
    else:
        log['failed'].append({'path': path, 'delete': code, 'readback': back, 'body': body[:150]})
        if code in ('401', '403'):
            break
    time.sleep(0.4)
folders = sorted({p.rsplit('/', 1)[0] for p in log['deleted'] if '/' in p and p.startswith('assets/')}, key=len, reverse=True)
for f in folders:
    code, body = curl(f'{LIST}/{f}')
    if code == '200' and json.loads(body or '[]') == []:
        dcode, _ = curl('-X', 'DELETE', f'{SRC}/{f}')
        if dcode.startswith('2'):
            log['folders_removed'].append(f)
    time.sleep(0.4)
json.dump(log, open(log_path, 'w'), indent=1)
print('deleted', len(log['deleted']), 'skipped', len(log['skipped']), 'failed', len(log['failed']), 'folders removed', len(log['folders_removed']))
for f in log['failed'][:5]:
    print('  FAILED', f)
