"""Extract the colour schemes of a Frontify document page (new document theme) from a reference capture.
Frontify resolves each section's colour scheme into inline CSS variables (--f-theme-settings-*) on the
section wrapper; this reads them in section order, groups identical sets into named schemes and writes
<out.json> = {"schemes": {"scheme-<hash>": {var: value}}, "sections": [...], "page": "scheme-<hash>"}.
Usage: python3 -I extract_section_schemes.py <capture.html> <out.json>
"""
import hashlib
import html
import json
import re
import sys

src, out = sys.argv[1:3]
h = open(src, encoding='utf-8').read()


def parse(style):
    v = {}
    for part in html.unescape(style).split(';'):
        if ':' in part and part.strip().startswith('--f-theme-settings-'):
            k, val = part.split(':', 1)
            v[k.strip()] = val.strip()
    return v


var_styles = [(m.start(), parse(m.group(1))) for m in re.finditer(r'style="([^"]*--f-theme-settings-background-color[^"]*)"', h)]
var_styles = [(pos, v) for pos, v in var_styles if v]
sections = [m.start() for m in re.finditer(r'data-test-id="section-root-container"', h)]
schemes, names, order = {}, {}, []


def name_of(v):
    # stable across pages and documents: named after a hash of the variable set
    sig = json.dumps({k: x for k, x in v.items() if '-list-' not in k}, sort_keys=True)
    if sig not in names:
        names[sig] = 'scheme-' + hashlib.sha1(sig.encode()).hexdigest()[:6]
        schemes[names[sig]] = v
    return names[sig]


page = name_of(var_styles[0][1]) if var_styles else None
for pos in sections:
    before = [v for p, v in var_styles if p < pos]
    order.append(name_of(before[-1]) if before else page)
json.dump({'schemes': schemes, 'sections': order, 'page': page}, open(out, 'w'), indent=1)
print(len(sections), 'sections;', {n: order.count(n) for n in schemes}, 'page', page)
for n, v in schemes.items():
    print(' ', n, 'background', v.get('--f-theme-settings-background-color'), 'text', v.get('--f-theme-settings-body-color'))
