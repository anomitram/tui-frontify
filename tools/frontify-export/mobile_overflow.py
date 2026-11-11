"""Detect source pages whose Frontify mobile layout overflows the viewport (content column 290px
instead of 219px, right edge clipped) by looking for content pixels right of the normal column
edge (x=330) below the header in the mobile reference screenshot.
Usage: python3 -I mobile_overflow.py <frontifyDir>
"""
import glob
import json
import os
import subprocess
import sys

F = sys.argv[1]
res = {}
for d in sorted(glob.glob(os.path.join(F, 'capture', '*', 'mobile.png'))):
    pid = d.split(os.sep)[-2]
    with open(d, 'rb') as fh:
        h = int.from_bytes(fh.read(24)[20:24], 'big')
    src = d if h <= 16000 else os.path.join(os.path.dirname(d), 'mobile-tiles', '00.png')
    hh = min(h, 16000) - 300
    # strip x 336..378, y 90..(h-300): count non-white pixels
    out = subprocess.run(['convert', f'{src}[42x{max(hh - 90, 1)}+336+90]', '-fuzz', '6%', '-fill', 'black', '-opaque', 'white',
                          '-fill', 'white', '+opaque', 'black', '-format', '%[fx:mean]', 'info:'], capture_output=True, text=True).stdout
    try:
        res[int(pid)] = round(float(out), 4)
    except ValueError:
        res[int(pid)] = None
wide = sorted(p for p, v in res.items() if v and v > 0.01)
json.dump({'mobile_content_share_right_of_column': res, 'wide_pages': wide}, open(os.path.join(F, 'mobile-overflow.json'), 'w'), indent=1)
print('pages with overflowing mobile layout in source:', len(wide), wide)
