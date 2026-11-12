"""Compose styles/theme-<name>.css from a hand-written head and generated parts.
The head (tools/frontify-export/themes/<name>.head.css) holds header, nav and sidebar rules;
generated parts (fonts.generated.css, schemes.generated.css of one or more documents) are appended.
Duplicate rules (same selector block text) are written once, so schemes shared by several
documents (hash-named: scheme-<sha1[:6]>) appear once.
Usage: python3 -I compose_theme.py <head.css> <out.css> <generated.css>...
"""
import re
import sys

head, out, *parts = sys.argv[1:]
chunks = [open(head, encoding='utf-8').read().rstrip()]
seen = set()
for p in parts:
    text = open(p, encoding='utf-8').read()
    # split into top-level rules (fonts and schemes are flat: no nesting)
    rules = re.findall(r'[^{}]+\{[^{}]*\}', text)
    kept = []
    for r in rules:
        key = re.sub(r'\s+', ' ', r).strip()
        # drop leading comments from the dedupe key
        key = re.sub(r'/\*.*?\*/', '', key).strip()
        if key in seen:
            continue
        seen.add(key)
        kept.append(r.strip())
    if kept:
        # values are Frontify's verbatim (rgba(), quotes): exempt from the style lint
        chunks.append(f'/* ---------- GENERATED from {p.split("migration-work/")[-1]} ---------- */\n'
                      '/* stylelint-disable */\n' + '\n\n'.join(kept) + '\n/* stylelint-enable */')
open(out, 'w', encoding='utf-8').write('\n\n'.join(chunks) + '\n')
print('written', out, 'rules', len(seen))
