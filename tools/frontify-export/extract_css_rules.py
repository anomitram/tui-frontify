"""Extract CSS rules whose selectors match given patterns (keeping their @media context) from a
large stylesheet, for reading exact source styling. Usage:
  python3 -I extract_css_rules.py <in.css> <out.css> <regex> [<regex> ...]
"""
import re
import sys

src, out, *pats = sys.argv[1:]
css = open(src, encoding='utf-8', errors='ignore').read()
rx = re.compile('|'.join(pats))
res = []


def walk(text, media=None):
    i = 0
    n = len(text)
    while i < n:
        j = text.find('{', i)
        if j < 0:
            break
        head = text[i:j].strip()
        depth = 1
        k = j + 1
        while k < n and depth:
            if text[k] == '{':
                depth += 1
            elif text[k] == '}':
                depth -= 1
            k += 1
        body = text[j + 1:k - 1]
        if head.startswith('@media') or head.startswith('@supports') or head.startswith('@container'):
            walk(body, head)
        elif not head.startswith('@') and rx.search(head):
            res.append(f"{media + ' { ' if media else ''}{head} {{{body}}}{' }' if media else ''}")
        i = k


walk(css)
open(out, 'w', encoding='utf-8').write('\n'.join(res) + '\n')
print(len(res), 'rules ->', out)
