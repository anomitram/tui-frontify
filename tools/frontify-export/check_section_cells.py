"""Which Frontify section elements are not rendered as grid cells?
Compares, per section of each captured page, the block ids in the export (page JSON) with the
data-block / data-controls-block ids rendered inside that section's grid in the capture (1440.html).
Blocks Frontify does not render (e.g. empty ones) must not become cells locally, or the following
cells shift in the grid. Writes <base>/hidden-blocks.json {pageId: [blockId, ...]}. Offline.
Usage: python3 -I check_section_cells.py <base> <docId> [<docId> ...]
"""
import glob
import json
import os
import re
import sys

base, *docs = sys.argv[1:]
hidden = {}
for d in docs:
    for f in sorted(glob.glob(f'{base}/{d}/raw/pages/*.json')):
        page = json.load(open(f))['page']
        cap = f"{base}/{d}/capture/{page['id']}/1440.html"
        if not os.path.exists(cap):
            continue
        h = open(cap, encoding='utf-8').read()
        # section holders carry the section id
        starts = [(m.start(), int(m.group(1))) for m in re.finditer(r'data-section="true" data-id="(\d+)"', h)]
        rendered = {}
        for i, (pos, sid) in enumerate(starts):
            end = starts[i + 1][0] if i + 1 < len(starts) else len(h)
            seg = h[pos:end]
            ids = re.findall(r'data-test-id="section-grid-container-item".*?data-(?:heading-id|controls-block|block|element-id)="(\d+)"', seg, flags=re.S)
            rendered[sid] = ids
        for s in page['sections']:
            if s['id'] not in rendered:
                continue  # tab group member not shown in the capture
            seg_ids = set(rendered[s['id']])
            for b in s['content']:
                bid = str(b['id'] if b.get('display_name') else b.get('section_element_id', b['id']))
                cand = {str(b['id']), str(b.get('section_element_id'))}
                if not cand & seg_ids:
                    hidden.setdefault(str(page['id']), []).append(b['id'])
                    print(page['id'], s['id'], b.get('display_name') or 'Heading', b['id'], 'not rendered',
                          '(cells rendered', len(rendered[s['id']]), 'of', len(s['content']), ')')
json.dump(hidden, open(f'{base}/hidden-blocks.json', 'w'), indent=1)
print('pages with hidden blocks', len(hidden), 'blocks', sum(len(v) for v in hidden.values()))
