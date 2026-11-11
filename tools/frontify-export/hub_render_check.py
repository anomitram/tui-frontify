"""Render check of a hub page URL against the Frontify reference at 1440/768/375: screenshots
(hub-shot-local.js), element positions (hub-compare-rects.js; images are matched by position
because preview/live rename them), pixel differences. Writes <outDir>/visual-report.json.
Usage: PW_PATH=... python3 -I hub_render_check.py <url> <captureDir> <outDir>
"""
import json
import os
import struct
import subprocess
import sys

url, cap, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
T = os.path.join(os.path.dirname(os.path.abspath(__file__)))
res = {}
for w in (1440, 768, 375):
    shot = os.path.join(out, f'{w}.png')
    subprocess.run(['node', os.path.join(T, 'hub-shot-local.js'), url, shot, str(w)], capture_output=True, text=True)
    rects = subprocess.run(['node', os.path.join(T, 'hub-compare-rects.js'), url, cap, str(w)], capture_output=True, text=True).stdout.strip().split('\n')
    open(os.path.join(out, f'rects-{w}.txt'), 'w').write('\n'.join(rects))
    ref = os.path.join(cap, f'{w}.png')
    rw, rh = struct.unpack('>II', open(ref, 'rb').read(24)[16:24])
    lw, lh = struct.unpack('>II', open(shot, 'rb').read(24)[16:24])
    W, H = min(rw, lw), min(rh, lh)

    def ae(y0, h):
        r = subprocess.run(['compare', '-metric', 'AE', '-fuzz', '10%', f'{ref}[{W}x{h}+0+{y0}]', f'{shot}[{W}x{h}+0+{y0}]', 'null:'], capture_output=True, text=True)
        return float(r.stderr.split()[0])
    ref_imgs = [e['rect'] for e in json.load(open(os.path.join(cap, f'{w}.styles.json')))['els']['img'] if e['rect'][2] > 0 and '/tui/' in e['src']]
    imgs = [line for line in rects if line.startswith('img')]
    img_ok = 0
    for line in imgs:
        tail = line.split('|')[-1].strip().replace('ref ', '')
        try:
            rect = [int(x) for x in tail.split(',')]
        except ValueError:
            continue
        if 'no reference' in line and rect in ref_imgs:
            img_ok += 1
        elif '| 0,0,0,0 |' in line:
            img_ok += 1
    other = [line for line in rects if line and not line.startswith('img')]
    res[w] = {
        'height_diff_px': lh - rh, 'header_diff_pct': round(100 * ae(0, 90) / (W * 90), 2),
        'below_header_diff_pct': round(100 * ae(90, H - 90) / (W * (H - 90)), 3),
        'images_at_reference_position': f'{img_ok}/{len(imgs)}',
        'text_elements_offset': sum(1 for line in other if '| 0,0,0,0 |' not in line), 'text_elements': len(other),
    }
    print(w, res[w])
json.dump(res, open(os.path.join(out, 'visual-report.json'), 'w'), indent=1)
