"""Print a condensed DOM skeleton (tag, classes, inline style, short text) of one rendered
Frontify block from a captured page, to read exact source styling.
Usage: python3 -I block_skeleton.py <rendered.html> <blockId> [maxDepth] [maxLines]
"""
import re
import sys
from html.parser import HTMLParser

path, block_id = sys.argv[1], sys.argv[2]
max_depth = int(sys.argv[3]) if len(sys.argv) > 3 else 14
max_lines = int(sys.argv[4]) if len(sys.argv) > 4 else 80
VOID = {'img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'path', 'rect', 'circle', 'use'}
SKIP_CLS = re.compile(r'^(tw-break-words|group.*|\[.*)$')


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.inside = None
        self.lines = []
        self.svg = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.inside is None and a.get('data-block') == block_id:
            self.inside = self.depth
        if self.inside is not None and tag not in VOID:
            pass
        if self.inside is not None:
            d = self.depth - self.inside
            if tag == 'svg':
                self.svg += 1
            if d <= max_depth and self.svg <= 1 and tag not in ('path', 'g', 'rect', 'circle', 'defs', 'clippath'):
                cls = ' '.join(c for c in (a.get('class') or '').split() if not SKIP_CLS.match(c))
                style = re.sub(r'--f-theme-settings-[\w-]+:[^;]+;?', '', a.get('style') or '')
                style = re.sub(r'var\(--f-theme-settings-([\w-]+)\)', r'$\1', style).strip()
                extra = ''
                for k in ('src', 'href', 'width', 'height', 'alt', 'data-test-id'):
                    if a.get(k):
                        extra += f' {k}="{a[k][:50]}"'
                self.lines.append('  ' * d + f'<{tag}' + (f' .{cls}' if cls else '') + (f' {{{style[:220]}}}' if style else '') + extra + '>')
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
        if self.inside is not None and data.strip() and self.svg == 0:
            d = self.depth - self.inside
            if d <= max_depth + 1:
                self.lines.append('  ' * d + '"' + data.strip()[:60] + '"')


p = P()
p.feed(open(path, encoding='utf-8').read())
print('\n'.join(p.lines[:max_lines]))
if len(p.lines) > max_lines:
    print(f'... ({len(p.lines)} lines)')
