"""Check that every downloaded asset's file signature matches its extension (integrity check
for files whose source sends no checksum). Updates manifest.json with `signature_ok`.
Usage: python3 -I check_signatures.py <assetsDir>
"""
import collections
import json
import os
import sys

d = sys.argv[1]
mp = os.path.join(d, 'manifest.json')
manifest = json.load(open(mp))
SIG = {
    'png': [b'\x89PNG'], 'jpg': [b'\xff\xd8\xff'], 'jpeg': [b'\xff\xd8\xff'], 'gif': [b'GIF8'],
    'pdf': [b'%PDF'], 'ai': [b'%PDF', b'%!PS'], 'zip': [b'PK\x03\x04'], 'docx': [b'PK\x03\x04'],
    'pptx': [b'PK\x03\x04'], 'xlsx': [b'PK\x03\x04'], 'wav': [b'RIFF'], 'mp3': [b'ID3', b'\xff\xfb', b'\xff\xf3', b'\xff\xf2'],
    'ase': [b'ASEF'], 'woff': [b'wOFF'], 'woff2': [b'wOF2'], 'ttf': [b'\x00\x01\x00\x00', b'true'], 'otf': [b'OTTO'],
    'svg': [b'<svg', b'<?xml'], 'webp': [b'RIFF'], 'eps': [b'%!PS', b'\xc5\xd0\xd3\xc6'],
}
res = collections.Counter()
bad = []
for m in manifest:
    if not m.get('file'):
        continue
    f = os.path.join(d, m['file'])
    head = open(f, 'rb').read(64)
    ext = os.path.splitext(m['file'])[1].lstrip('.').lower()
    if ext in ('mp4', 'mov', 'm4v'):
        ok = head[4:8] == b'ftyp'
    elif ext in SIG:
        ok = any(head.lstrip()[:len(s)] == s or head[:len(s)] == s for s in SIG[ext])
    else:
        ok = None
    m['signature_ok'] = ok
    res[(ext, ok)] += 1
    if ok is False:
        bad.append((m['key'], m['file'], head[:12]))
json.dump(manifest, open(mp, 'w'), indent=2)
print(sorted(res.items(), key=lambda x: str(x)))
print('bad', bad[:20])
