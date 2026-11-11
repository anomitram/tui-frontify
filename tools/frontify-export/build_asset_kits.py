"""Pre-build the "Download package" zip for every Frontify Asset Kit block.

Frontify zips asset kits on demand server-side; Edge Delivery has no server, so the package is
built once from the downloaded originals and recorded in the manifest as a derived file.
Usage: python3 -I build_asset_kits.py <frontifyDir>
"""
import glob
import hashlib
import json
import os
import re
import sys
import zipfile

fdir = sys.argv[1]
assets_dir = os.path.join(fdir, 'assets')
manifest_path = os.path.join(assets_dir, 'manifest.json')
manifest = json.load(open(manifest_path))
by_key = {m['key']: m for m in manifest}


def title_text(slate):
    try:
        nodes = json.loads(slate)
    except Exception:
        return ''
    def t(n):
        return n.get('text', '') + ''.join(t(c) for c in n.get('children', []))
    return ' '.join(t(n) for n in nodes).strip()


built = []
for f in sorted(glob.glob(os.path.join(fdir, 'raw', 'pages', '*.json'))):
    page = json.load(open(f))['page']
    for s in page['sections']:
        for b in s['content']:
            if b.get('display_name') != 'Asset Kit':
                continue
            files = []
            for a in (b.get('assets') or {}).get('images', []):
                m = by_key.get(f"asset-{a['id']}")
                if m and m.get('file'):
                    files.append((os.path.join(assets_dir, m['file']), m.get('file_name') or os.path.basename(m['file'])))
            title = title_text(b['settings'].get('title', '')) or f"Asset Kit {b['id']}"
            name = re.sub(r'[^\w .-]+', '', title).strip()[:80] or f"asset-kit-{b['id']}"
            key = f"assetkit-{b['id']}"
            out_dir = os.path.join(assets_dir, key)
            os.makedirs(out_dir, exist_ok=True)
            out = os.path.join(out_dir, f"{name}.zip")
            used = set()
            with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_STORED) as z:
                for path, arcname in files:
                    base, ext = os.path.splitext(arcname)
                    n, i = arcname, 1
                    while n in used:
                        n = f"{base} ({i}){ext}"
                        i += 1
                    used.add(n)
                    z.write(path, n)
            data = open(out, 'rb').read()
            entry = {
                'key': key, 'file': os.path.relpath(out, assets_dir), 'file_name': os.path.basename(out),
                'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'md5': hashlib.md5(data).hexdigest(),
                'derived': True, 'derived_from': [f"asset-{a['id']}" for a in (b.get('assets') or {}).get('images', [])],
                'source_url': None, 'fetched_via': 'built locally (Frontify packages kits on demand)',
                'refs': [{'page_id': page['id'], 'section_id': s['id'], 'block_id': b['id'], 'block_type': 'Asset Kit', 'field': 'package'}],
            }
            by_key[key] = entry
            built.append((key, len(files), len(data)))

manifest = [m for m in manifest if not m['key'].startswith('assetkit-')] + [by_key[k] for k, _, _ in built]
json.dump(manifest, open(manifest_path, 'w'), indent=2)
for k, n, size in built:
    print(k, n, 'files', size, 'bytes')
