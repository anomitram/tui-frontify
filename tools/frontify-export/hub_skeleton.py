"""Print the DOM skeleton (tag, classes, inline style, short text) of one hub grid row from a
captured Frontify hub page, to read exact source structure/styling.
Usage: python3 -I hub_skeleton.py <captured.html> <data-row id> [maxDepth] [maxLines]
"""
import re
import sys
from html.parser import HTMLParser

path, row_id = sys.argv[1], sys.argv[2]
max_depth = int(sys.argv[3]) if len(sys.argv) > 3 else 8
max_lines = int(sys.argv[4]) if len(sys.argv) > 4 else 60
VOID = {'img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'path', 'rect', 'circle', 'use', 'line', 'polyline'}


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.inside = None
        self.lines = []
        self.svg = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.inside is None and a.get('data-row') == row_id:
            self.inside = self.depth
        if self.inside is not None:
            d = self.depth - self.inside
            if tag == 'svg':
                self.svg += 1
            if d <= max_depth and self.svg <= 1 and tag not in ('path', 'g', 'defs'):
                cls = ' '.join(c for c in (a.get('class') or '').split() if not c.startswith('js-'))
                style = (a.get('style') or '').strip()
                extra = ''.join(f' {k}="{a[k][:60]}"' for k in ('href', 'data-row', 'data-column', 'data-width', 'width', 'height') if a.get(k))
                if a.get('src'):
                    extra += f' src=…{a["src"].split("?")[0][-28:]}'
                self.lines.append('  ' * d + f'<{tag}' + (f' .{cls}' if cls else '') + (f' {{{style[:240]}}}' if style else '') + extra + '>')
        if tag not in VOID:
            self.depth += 1

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        self.depth -= 1
        if tag == 'svg' and self.svg:
            self.svg -= 1
        if self.inside is not None and self.depth == self.inside:
            self.inside = None

    def handle_data(self, data):
        t = data.strip().replace('﻿', '')
        if self.inside is not None and t and self.svg == 0 and self.depth - self.inside <= max_depth + 1:
            self.lines.append('  ' * (self.depth - self.inside) + '"' + t[:60] + '"')


p = P()
p.feed(open(path, encoding='utf-8').read())
print('\n'.join(p.lines[:max_lines]))
if len(p.lines) > max_lines:
    print(f'... ({len(p.lines)} lines)')
