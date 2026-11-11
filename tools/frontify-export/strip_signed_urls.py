"""Remove signed parts from stored Frontify export JSON (hard rule: never store signed URLs or tokens):
S3 pre-signed query strings (X-Amz-*) are cut from URLs and "token"/"license_token" values are blanked.
Run after the assets are downloaded; re-export if a download is needed again.
Usage: python3 -I strip_signed_urls.py <dir> [<dir> ...]   (all *.json below, rewritten in place)
"""
import json
import os
import re
import sys

SIGNED = re.compile(r'\?X-Amz-[^"\s]*')
changed = 0
for root_dir in sys.argv[1:]:
    for root, _, files in os.walk(root_dir):
        for f in files:
            if not f.endswith('.json'):
                continue
            p = os.path.join(root, f)
            s = open(p, encoding='utf-8').read()
            n = SIGNED.sub('', s)
            n = re.sub(r'("(?:license_)?token"\s*:\s*)"[^"]*"', r'\1"[removed]"', n)
            if n != s:
                json.loads(n)  # still valid JSON
                open(p, 'w', encoding='utf-8').write(n)
                changed += 1
                print('stripped', p)
print(changed, 'files changed')
