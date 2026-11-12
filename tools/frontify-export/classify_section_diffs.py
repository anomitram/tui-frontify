"""Group the section height differences found by doc-compare-sections.js by the blocks the
sections contain, so the block causing a difference can be found. Only sections whose own height
differs (not just shifted) are counted. Offline.
Usage: python3 -I classify_section_diffs.py <compare.json> <base> [--min 3]
"""
import collections
import json
import sys

cmp_file, base = sys.argv[1:3]
MIN = int(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 3
report = {r['path']: r for r in json.load(open(f'{base}/build-report.json'))}
runs = json.load(open(cmp_file))
by_type = collections.defaultdict(list)
for run in runs:
    if run.get('error'):
        continue
    meta = report[run['path']]
    page = json.load(open(f"{base}/{meta['doc']}/raw/pages/{meta['page']}.json"))['page']
    secs = sorted(page['sections'], key=lambda s: s['sort'])
    # visual slots (a tab group is one slot)
    slots, last = [], None
    for s in secs:
        if s.get('group_id') and s['group_id'] == last:
            continue
        slots.append(s)
        last = s.get('group_id')
    for d in run.get('sectionDiffs', []):
        if d.get('missing') or abs(d['dh']) < MIN:
            continue
        s = slots[d['i']] if d['i'] < len(slots) else None
        types = tuple(sorted({b.get('display_name') or 'Heading' for b in (s['content'] if s else [])}))
        by_type[types].append((run['w'], run['path'].replace('/the-mora/', ''), d['i'], d['dh'], s['column_proportions'] if s else None))
for types, items in sorted(by_type.items(), key=lambda x: -len(x[1])):
    print(len(items), '+'.join(types))
    for it in items[:6]:
        print('    ', it)
