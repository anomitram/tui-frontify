"""Compare local screenshots with the Frontify reference screenshots.

For each page/viewport: image sizes, height difference, and the share of differing pixels
(ImageMagick `compare -metric AE -fuzz 10%`) over the common area. On mobile the content area is
compared with the deliberate 21px horizontal shift compensated (the source clips text there).
Writes migration-work/frontify/visual-report.json and side-by-side PNGs for review.
Usage: python3 -I visual_compare.py <frontifyDir> [pageId,...]
"""
import json
import os
import subprocess
import sys

F = sys.argv[1]
only = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
ref_dir = os.path.join(F, 'capture')
loc_dir = os.path.join(F, 'local-shots')
out_dir = os.path.join(F, 'visual-diff')
os.makedirs(out_dir, exist_ok=True)


def size(p):
    with open(p, 'rb') as fh:
        head = fh.read(24)
    return int.from_bytes(head[16:20], 'big'), int.from_bytes(head[20:24], 'big')


LIMIT = 16000
TILE = 8000


def ae_tall(ref, loc, w, h):
    # Images over ImageMagick's height limit were split into 8000px tiles (tile-tall-png.js).
    total = 0.0
    n = 0
    while n * TILE < h:
        th = min(TILE, h - n * TILE)
        tr = ref if size(ref)[1] <= LIMIT else os.path.join(os.path.splitext(ref)[0] + '-tiles', f'{n:02d}.png')
        tl = loc if size(loc)[1] <= LIMIT else os.path.join(os.path.splitext(loc)[0] + '-tiles', f'{n:02d}.png')
        gr = f'{w}x{th}+0+{n * TILE}' if tr == ref else f'{w}x{th}+0+0'
        gl = f'{w}x{th}+0+{n * TILE}' if tl == loc else f'{w}x{th}+0+0'
        if not (os.path.exists(tr) and os.path.exists(tl)):
            return None
        v = ae(tr, tl, gr, gl)
        if v is None:
            return None
        total += v
        n += 1
    return total


def ae(a, b, geom_a, geom_b):
    r = subprocess.run(['compare', '-metric', 'AE', '-fuzz', '10%',
                        f'{a}[{geom_a}]', f'{b}[{geom_b}]', 'null:'], capture_output=True, text=True)
    try:
        return float(r.stderr.split()[0])
    except Exception:
        return None


report = []
for pid in sorted(os.listdir(loc_dir)):
    if only and pid not in only:
        continue
    for vp in ('desktop', 'mobile'):
        ref = os.path.join(ref_dir, pid, f'{vp}.png')
        loc = os.path.join(loc_dir, pid, f'{vp}.png')
        if not (os.path.exists(ref) and os.path.exists(loc)):
            continue
        rw, rh = size(ref)
        lw, lh = size(loc)
        h = min(rh, lh)
        w = min(rw, lw)
        if max(rh, lh) > LIMIT:
            diff = ae_tall(ref, loc, w, h)
            area = w * h
        elif vp == 'mobile':
            # header/rail unshifted; content compared with the deliberate 21px left shift compensated
            hd = ae(ref, loc, f'{w}x90+0+0', f'{w}x90+0+0') or 0
            cw = 269
            ct = ae(ref, loc, f'{cw}x{h - 90}+111+90', f'{cw}x{h - 90}+90+90') or 0
            diff = hd + ct
            area = w * 90 + cw * (h - 90)
        else:
            diff = ae(ref, loc, f'{w}x{h}+0+0', f'{w}x{h}+0+0')
            area = w * h
        pct = round(100 * diff / area, 2) if diff is not None else None
        rec = {'page_id': int(pid), 'viewport': vp, 'ref': [rw, rh], 'local': [lw, lh],
               'height_diff_px': lh - rh, 'height_diff_pct': round(100 * (lh - rh) / rh, 2), 'diff_pixels_pct': pct}
        report.append(rec)
        if max(rh, lh) <= LIMIT:
            side = os.path.join(out_dir, f'{pid}-{vp}.png')
            scale = '25%' if vp == 'desktop' else '50%'
            subprocess.run(['convert', '(', ref, '-resize', scale, ')', '(', loc, '-resize', scale, ')',
                            '-background', 'white', '-gravity', 'north', '+append', side])
json.dump(report, open(os.path.join(F, 'visual-report.json'), 'w'), indent=1)
for r in sorted(report, key=lambda r: -(r['diff_pixels_pct'] or 0))[:25]:
    print(r['page_id'], r['viewport'], 'h', r['ref'][1], '->', r['local'][1], f"({r['height_diff_pct']}%)", 'diff', r['diff_pixels_pct'], '%')
print('pages compared', len({r['page_id'] for r in report}), 'records', len(report))
