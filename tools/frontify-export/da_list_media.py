"""List the media files in Document Authoring folders (read-only) and write them to a JSON plan, so a
later clean-up deletes exactly the files recorded here and nothing uploaded afterwards.
Usage: python3 -I da_list_media.py <org> <repo> <out.json> <folder> [<folder> ...]
  folder e.g. .tuimagiclife  assets/cell-495-1  (recursive into sub-folders)
"""
import json
import subprocess
import sys
import time

org, repo, out, *folders = sys.argv[1:]
BASE = f'https://admin.da.live/list/{org}/{repo}'


def ls(folder):
    r = subprocess.run(['curl', '-sS', '-w', '\n%{http_code}', f'{BASE}/{folder}'], capture_output=True, text=True)
    body, _, code = r.stdout.rpartition('\n')
    if code != '200':
        raise SystemExit(f'STOP {code} listing /{folder}')
    time.sleep(0.5)
    return json.loads(body)


files = []
todo = list(folders)
while todo:
    f = todo.pop(0)
    for item in ls(f):
        rel = item['path'].split(f'/{org}/{repo}/', 1)[1]
        if item.get('ext'):
            files.append({'path': rel, 'ext': item['ext'], 'lastModified': item.get('lastModified')})
        else:
            todo.append(rel)
json.dump({'when': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'folders': folders, 'files': files}, open(out, 'w'), indent=1)
print(len(files), 'files listed ->', out)
