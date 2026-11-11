"""Resize published images so they stay under the Edge Delivery 20 MB image limit.

Keeps format, file name, aspect ratio and colour profile; picks a width whose file is <= TARGET
bytes (18 MB, leaving margin). Starts from an estimate (file size scales ~ with pixel area) and
re-estimates from each measured size until it fits. Originals stay untouched in migration-work/frontify/assets.
Skips images already resized under the target (safe to re-run).
Usage: python3 -I resize_for_eds.py <outDir> <publishedPath> [<publishedPath> ...]
  publishedPath: path under content/, e.g. /assets/asset-58935/Live-Happy_placements_Pic.png
"""
import json
import math
import os
import subprocess
import sys

TARGET = 18_000_000
out_dir = sys.argv[1]
log_path = os.path.join(out_dir, 'resize-log.json')
results = json.load(open(log_path)) if os.path.exists(log_path) else []
done = {r['path'] for r in results if r.get('under_target')}

for rel in sys.argv[2:]:
    if rel in done:
        print('already done', rel, flush=True)
        continue
    src = os.path.join('content', rel.lstrip('/'))
    w = int(subprocess.run(['identify', '-format', '%w', src], capture_output=True, text=True).stdout)
    orig = os.path.getsize(src)
    dest_dir = os.path.join(out_dir, os.path.dirname(rel.lstrip('/')))
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, os.path.basename(rel))
    tmp = dest + '.part.png'
    frac = min(0.95, math.sqrt(TARGET * 0.95 / orig))
    ok = False
    while frac > 0.2:
        nw = int(w * frac)
        subprocess.run(['convert', src, '-resize', f'{nw}x', '-define', 'png:compression-level=9', tmp], check=True)
        size = os.path.getsize(tmp)
        print(rel, 'width', nw, 'bytes', size, flush=True)
        if size <= TARGET:
            os.replace(tmp, dest)
            ok = True
            break
        # size scales roughly with pixel area: aim 3% under the target from the measured size
        frac = min(frac - 0.01, frac * math.sqrt(TARGET * 0.97 / size))
    dims = subprocess.run(['identify', '-format', '%wx%h', dest], capture_output=True, text=True).stdout if ok else None
    results = [r for r in results if r['path'] != rel] + [{
        'path': rel, 'original_width': w, 'original_bytes': orig, 'resized': dest, 'resized_dims': dims,
        'resized_bytes': os.path.getsize(dest) if ok else None, 'under_target': ok}]
    json.dump(results, open(log_path, 'w'), indent=1)
print('finished', sum(1 for r in results if r['under_target']), 'of', len(sys.argv) - 2, flush=True)
