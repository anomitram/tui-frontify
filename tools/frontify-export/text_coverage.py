"""Text coverage of migrated Frontify document pages (new document theme).
Compares the words shown in the page sections of the reference capture (<capture>/1440.html,
everything inside data-test-id="section-holder") with the words of the imported page
(content/<path>.plain.html). Prints per page the share of source words found and the missing
words, so dropped content shows up. Offline.
Usage: python3 -I text_coverage.py <build-report.json> <base> <contentDir> [--show N]
"""
import collections
import html
import json
import re
import sys
from html.parser import HTMLParser

report, base, content = sys.argv[1:4]
show = int(sys.argv[sys.argv.index('--show') + 1]) if '--show' in sys.argv else 12


def words(text):
    text = html.unescape(text).replace('​', ' ').replace(' ', ' ').lower()
    return re.findall(r"[0-9a-zà-ÿ]+(?:['’][a-z]+)?", text)


class Text(HTMLParser):
    """Visible text; with sections=True only inside data-test-id="section-holder" elements."""

    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}

    def __init__(self, sections=False):
        super().__init__(convert_charrefs=True)
        self.sections, self.stack, self.out, self.skip = sections, [], [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            return
        a = dict(attrs)
        holder = a.get('data-test-id') == 'section-holder'
        # screen-reader helpers of the editor (drag and drop, annotation editing) and video fallbacks
        hidden = (tag in ('script', 'style', 'svg', 'template', 'video')
                  or (a.get('aria-hidden') == 'true' and tag == 'span')
                  or (a.get('id') or '').startswith(('DndDescribedBy', 'DndLiveRegion'))
                  or a.get('role') == 'status'
                  or 'display: none' in (a.get('style') or '')
                  or 'tw-sr-only' in (a.get('class') or '').split())
        self.stack.append((tag, holder, hidden))
        if hidden:
            self.skip += 1

    def handle_endtag(self, tag):
        while self.stack:
            t, _h, hidden = self.stack.pop()
            if hidden:
                self.skip -= 1
            if t == tag:
                break

    def handle_data(self, data):
        if self.skip:
            return
        if self.sections and not any(h for _t, h, _x in self.stack):
            return
        self.out.append(data)


def strip(h, sections=False):
    p = Text(sections)
    p.feed(h)
    return ' '.join(p.out)


def sections_text(h):
    # text inside the section holders (main content only: no sidebar, header, footer)
    return strip(h, sections=True)


total_missing = 0
for r in json.load(open(report)):
    cap = f"{base}/{r['doc']}/capture/{r['page']}/1440.html"
    try:
        src = collections.Counter(words(sections_text(open(cap, encoding='utf-8').read())))
    except FileNotFoundError:
        print(r['path'], 'no capture')
        continue
    try:
        dst_html = open(f"{content}{r['path']}.plain.html", encoding='utf-8').read()
    except FileNotFoundError:
        print(r['path'], 'NOT IMPORTED')
        continue
    # metadata block text is not page content
    dst_html = re.sub(r'<div class="metadata">.*', '', dst_html, flags=re.S)
    dst = collections.Counter(words(strip(dst_html)))
    missing = {w: c - dst.get(w, 0) for w, c in src.items() if c > dst.get(w, 0)}
    n = sum(src.values())
    miss = sum(missing.values())
    total_missing += miss
    pct = 100 * (n - miss) / n if n else 100
    top = sorted(missing.items(), key=lambda x: -x[1])[:show]
    print(f"{pct:5.1f}% {r['path']} words={n} missing={miss} {' '.join(f'{w}x{c}' for w, c in top)}")
print('total missing words', total_missing)
