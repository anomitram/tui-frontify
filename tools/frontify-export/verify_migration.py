"""Verify the migrated content against the Frontify export (offline).

Checks per page: block counts by type, text (every word of the source appears in the output),
assets (exist, checksum, published copy), internal links/anchors, runtime dependencies.
Usage: python3 -I verify_migration.py <repoDir>   -> writes migration-work/frontify/verification.json
"""
import collections
import glob
import hashlib
import html
import json
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urlparse

repo = sys.argv[1]
CONF = json.load(open(os.path.join(repo, 'tools', 'frontify-export', 'frontify.config.json')))
SRC_HOST = urlparse(CONF['host']).netloc
F = os.path.join(repo, 'migration-work', 'frontify')
C = os.path.join(repo, 'content')

nav = json.load(open(os.path.join(F, 'raw', 'navigation.json')))['data']
paths = {}
for n in nav:
    t = n['translations']['default']
    if n['type'] == 'page_category':
        for c in n.get('children', []):
            if c['type'] == 'page':
                paths[c['id']] = f"/{t['slug']}/{c['translations']['default']['slug']}"
    elif n['type'] == 'page':
        paths[n['id']] = f"/{t['slug']}"

BLOCK_CLASS = {
    'Callout': 'callout', 'Image': 'image', 'Video': 'video', 'Annotations': 'annotations',
    'Image grid': 'image-grid', 'Divider': 'divider', 'Attachments': 'attachments', 'Colors': 'colors',
    'Asset Kit': 'asset-kit', 'Audio': 'audio',
}

WORD = re.compile(r"[0-9A-Za-zÀ-ÿ’'%#&*+@]+")


def words(text):
    return [w.lower().strip("'’") for w in WORD.findall(html.unescape(text)) if w.strip("'’")]


def slate_text(v):
    if not v:
        return ''
    if isinstance(v, str):
        if not v.strip().startswith('['):
            return re.sub(r'<[^>]+>', ' ', v)
        try:
            v = json.loads(v)
        except Exception:
            return v
    out = []

    def w(n):
        if isinstance(n, list):
            for x in n:
                w(x)
        elif isinstance(n, dict):
            if 'text' in n:
                out.append(html.unescape(n['text']))  # inline leaves join without spaces
            for c in n.get('children', []):
                w(c)
            if n.get('type') and n.get('type') not in ('a', 'link', 'button'):
                out.append(' ')  # block-level boundary
    w(v)
    return ''.join(out)


class Out(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.blocks = collections.Counter()
        self.links = []
        self.srcs = []
        self.ids = set()
        self.h2 = []
        self._h2 = None
        self.meta_depth = None
        self.depth = 0
        self.empty_sections = 0

    BLOCK_TAGS = {'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'br', 'blockquote', 'picture', 'img'}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in self.BLOCK_TAGS:
            self.text.append(' ')
        self.depth += 1
        cls = (a.get('class') or '').split()
        if tag == 'div' and cls:
            if cls[0] in ('metadata', 'section-metadata'):
                if self.meta_depth is None:
                    self.meta_depth = self.depth
            else:
                self.blocks[cls[0]] += 1
        if a.get('id'):
            self.ids.add(a['id'])
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
        for k in ('src', 'srcset', 'poster'):
            if a.get(k):
                self.srcs.append(a[k])
        if tag == 'h2':
            self._h2 = []

    def handle_endtag(self, tag):
        if tag == 'h2' and self._h2 is not None:
            self.h2.append(''.join(self._h2).strip())
            self._h2 = None
        if self.meta_depth is not None and self.depth == self.meta_depth:
            self.meta_depth = None
        self.depth -= 1

    def handle_data(self, data):
        if self._h2 is not None:
            self._h2.append(data)
        if self.meta_depth is not None:
            if data.strip().lower() == 'empty':
                self.empty_sections += 1
            return
        self.text.append(data)


def colors_words(capdir, block_id):
    try:
        g = json.load(open(os.path.join(capdir, 'graphql.json')))
    except Exception:
        return []
    out = []
    for x in g:
        if x['op'] != 'getColorBlockColors':
            continue
        for b in x['data']['data']['brandEssentialsColorBlocksByIds']['brandEssentialsColorBlocks']:
            import base64
            if json.loads(base64.b64decode(b['id']))['identifier'] != block_id:
                continue
            for c in b['colors']:
                out.append(c.get('name') or '')
                out.append(c.get('description') or '')
    return words(' '.join(out))


# ---------- pages ----------
pages_report = []
all_content_files = {os.path.relpath(p, C)[:-len('.plain.html')] for p in glob.glob(os.path.join(C, '**', '*.plain.html'), recursive=True)}
manifest = json.load(open(os.path.join(F, 'assets', 'manifest.json')))
by_key = {m['key']: m for m in manifest}
sidebar = open(os.path.join(C, 'sidebar.plain.html'), encoding='utf-8').read()
heading_slugs = collections.defaultdict(set)
for href in re.findall(r'href="([^"]+)"', sidebar):
    u = urlparse(href)
    if u.fragment:
        heading_slugs[u.path].add(unquote(u.fragment))

link_issues = []
runtime_deps = []
out_of_scope = collections.Counter()
for pid, path in sorted(paths.items(), key=lambda x: x[1]):
    page = json.load(open(os.path.join(F, 'raw', 'pages', f'{pid}.json')))['page']
    out_file = os.path.join(C, path.lstrip('/') + '.plain.html')
    rep = {'page_id': pid, 'path': path, 'exists': os.path.exists(out_file)}
    if not rep['exists']:
        pages_report.append(rep)
        continue
    o = Out()
    o.feed(open(out_file, encoding='utf-8').read())
    src_counts = collections.Counter()
    src_words = []
    headings = []
    empty = 0
    capdir = os.path.join(F, 'capture', str(pid))
    for s in page['sections']:
        if not s['content']:
            empty += 1
        for b in s['content']:
            t = b.get('display_name') or 'Heading'
            src_counts[t] += 1
            st = b.get('settings') or {}
            if t == 'Heading':
                headings.append(b.get('title') or '')
                src_words += words(b.get('title') or '')
            elif t == 'Text':
                src_words += words(slate_text(st.get('content')))
            elif t == 'Callout':
                src_words += words(slate_text(st.get('textValue')))
            elif t == 'Image':
                src_words += words(slate_text(st.get('name'))) + words(slate_text(st.get('description')))
            elif t == 'Video':
                src_words += words(slate_text(st.get('title')))
            elif t == 'Annotations':
                for an in st.get('annotations') or []:
                    src_words += words(re.sub(r'<[^>]+>', ' ', an.get('content') or ''))
            elif t == 'Image grid':
                for it in st.get('assets') or []:
                    src_words += words(re.sub(r'<[^>]+>', ' ', it.get('title') or '')) + words(re.sub(r'<[^>]+>', ' ', it.get('caption') or ''))
            elif t == 'Attachments':
                for d in st.get('downloads') or []:
                    src_words += words(html.unescape(d.get('title') or ''))
            elif t == 'Colors':
                src_words += words(st.get('title') or '') + words(st.get('description') or '') + colors_words(capdir, b['id'])
            elif t == 'Asset Kit':
                src_words += words(slate_text(st.get('title'))) + words(slate_text(st.get('description')))
            elif t == 'Audio':
                src_words += words(slate_text(st.get('title')))
    src_words += words(page.get('title') or '')
    out_words = collections.Counter(words(''.join(o.text)))
    missing = collections.Counter(src_words) - out_words
    blocks_ok = {}
    for t, cls in BLOCK_CLASS.items():
        blocks_ok[t] = {'source': src_counts.get(t, 0), 'migrated': o.blocks.get(cls, 0)}
    text_blocks = o.blocks.get('text', 0)
    norm = lambda t: re.sub(r'\s+', ' ', html.unescape(t)).strip()
    out_h2 = [norm(h) for h in o.h2]
    h2_ok = all(norm(h) in out_h2 for h in headings)
    rep.update({
        'source_counts': dict(src_counts), 'blocks': blocks_ok, 'text_blocks_as_block': text_blocks,
        'headings_source': len(headings), 'headings_found': sum(1 for h in headings if norm(h) in out_h2), 'headings_ok': h2_ok,
        'empty_sections_source': empty, 'empty_sections_migrated': o.empty_sections,
        'source_words': len(src_words), 'missing_words': sum(missing.values()), 'missing_sample': list(missing.items())[:12],
        'block_counts_match': all(v['source'] == v['migrated'] for v in blocks_ok.values()) and h2_ok and empty == o.empty_sections,
    })
    # links
    for href in o.links:
        u = urlparse(href)
        if u.scheme in ('http', 'https'):
            if u.netloc.endswith(SRC_HOST):
                out_of_scope[href] += 1
            continue
        if u.scheme == 'mailto' or href.startswith('#'):
            continue
        if href.startswith('/assets/'):
            if not os.path.exists(os.path.join(C, unquote(u.path).lstrip('/'))):
                link_issues.append({'page': path, 'href': href, 'issue': 'asset file missing'})
            continue
        target = unquote(u.path).strip('/') or 'index'
        if target not in all_content_files:
            link_issues.append({'page': path, 'href': href, 'issue': 'page missing'})
        elif u.fragment and u.fragment not in heading_slugs.get('/' + target, set()):
            link_issues.append({'page': path, 'href': href, 'issue': 'anchor not a page heading'})
    for s in o.srcs:
        for part in [x.strip().split(' ')[0] for x in s.split(',')]:
            if re.search(r'tui-brandhub\.com|frontify\.com|frontify-artifacts\.com|ffycdn\.net', part):
                runtime_deps.append({'page': path, 'src': part})
            elif part.startswith('/assets/') and not os.path.exists(os.path.join(C, unquote(part).lstrip('/'))):
                link_issues.append({'page': path, 'href': part, 'issue': 'media file missing'})
    pages_report.append(rep)

# ---------- chrome docs ----------
for doc in ('nav', 'sidebar', 'footer'):
    txt = open(os.path.join(C, f'{doc}.plain.html'), encoding='utf-8').read()
    for href in re.findall(r'href="([^"]+)"', txt):
        u = urlparse(href)
        if u.scheme in ('http', 'https'):
            if u.netloc.endswith(SRC_HOST):
                out_of_scope[href] += 1
            continue
        if href.startswith('/assets/'):
            continue
        target = unquote(u.path).strip('/') or 'index'
        if target not in all_content_files:
            link_issues.append({'page': f'/{doc}', 'href': href, 'issue': 'page missing'})
    for s in re.findall(r'src="([^"]+)"', txt):
        if re.search(r'tui-brandhub\.com|frontify|ffycdn', s):
            runtime_deps.append({'page': f'/{doc}', 'src': s})

# code: no runtime dependency on Frontify hosts (links in comments are fine)
code_deps = []
for p in glob.glob(os.path.join(repo, '**', '*.*'), recursive=True):
    rel = os.path.relpath(p, repo)
    if rel.startswith(('node_modules', 'migration-work', 'content', '.git', 'tools', '.migration')) or not rel.endswith(('.js', '.css', '.html', '.json')):
        continue
    t = open(p, encoding='utf-8', errors='ignore').read()
    for m_ in re.finditer(r'(src|url|import|fetch|href)\s*[=(:]\s*[\'"`]?https?://[^\'"`\s)]*(tui-brandhub\.com|frontify\.com|frontify-artifacts\.com|ffycdn\.net)', t):
        code_deps.append({'file': rel, 'match': m_.group(0)[:120]})

# ---------- assets ----------
asset_rep = {'total': 0, 'present': 0, 'sha_ok': 0, 'published_ok': 0, 'source_checksum_verified': 0, 'size_verified_only': 0, 'derived': 0, 'problems': []}
for m in manifest:
    if not m.get('file'):
        asset_rep['problems'].append({'key': m['key'], 'issue': 'not downloaded'})
        continue
    asset_rep['total'] += 1
    f = os.path.join(F, 'assets', m['file'])
    if not os.path.exists(f):
        asset_rep['problems'].append({'key': m['key'], 'issue': 'file missing'})
        continue
    asset_rep['present'] += 1
    sha = hashlib.sha256(open(f, 'rb').read()).hexdigest()
    if sha == m.get('sha256'):
        asset_rep['sha_ok'] += 1
    else:
        asset_rep['problems'].append({'key': m['key'], 'issue': 'sha256 mismatch'})
    if m.get('derived'):
        asset_rep['derived'] += 1
    elif m.get('checksum_verified') is True:
        asset_rep['source_checksum_verified'] += 1
    elif m.get('size_verified') is True:
        asset_rep['size_verified_only'] += 1
    if not m['key'].startswith(('font-', 'bfont-')):
        safe = re.sub(r'[^\w.\-]+', '_', re.sub(r'\s+', '-', os.path.basename(m['file'])))
        pub = os.path.join(C, 'assets', m['key'], safe)
        if os.path.exists(pub) and hashlib.sha256(open(pub, 'rb').read()).hexdigest() == sha:
            asset_rep['published_ok'] += 1
        elif m['key'].startswith('theme-'):
            cands = glob.glob(os.path.join(C, 'assets', m['key'], '*'))
            if cands and hashlib.sha256(open(cands[0], 'rb').read()).hexdigest() == sha:
                asset_rep['published_ok'] += 1
            else:
                asset_rep['problems'].append({'key': m['key'], 'issue': 'published copy missing/different'})
        else:
            asset_rep['problems'].append({'key': m['key'], 'issue': 'published copy missing/different'})

summary = {
    'pages_total': len(paths),
    'pages_migrated': sum(1 for p in pages_report if p.get('exists')),
    'pages_block_counts_match': sum(1 for p in pages_report if p.get('block_counts_match')),
    'pages_text_complete': sum(1 for p in pages_report if p.get('exists') and p['missing_words'] == 0),
    'internal_link_issues': len(link_issues),
    'runtime_dependencies_in_content': len(runtime_deps),
    'runtime_dependencies_in_code': len(code_deps),
    'out_of_scope_links_unique': len(out_of_scope),
    'assets': {k: v for k, v in asset_rep.items() if k != 'problems'},
    'asset_problems': len(asset_rep['problems']),
}
json.dump({'summary': summary, 'pages': pages_report, 'link_issues': link_issues, 'runtime_deps': runtime_deps,
           'code_deps': code_deps, 'out_of_scope_links': out_of_scope.most_common(), 'asset_problems': asset_rep['problems']},
          open(os.path.join(F, 'verification.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps(summary, indent=1))
bad = [p for p in pages_report if not p.get('block_counts_match') or p.get('missing_words')]
for p in bad[:20]:
    print('PAGE', p['path'], 'blocks_ok' if p.get('block_counts_match') else {k: v for k, v in p.get('blocks', {}).items() if v['source'] != v['migrated']},
          'headings', p.get('headings_found'), '/', p.get('headings_source'), 'empty', p.get('empty_sections_source'), p.get('empty_sections_migrated'),
          'missing', p.get('missing_words'), p.get('missing_sample'))
for li in link_issues[:15]:
    print('LINK', li)
for d in (runtime_deps + code_deps)[:10]:
    print('DEP', d)
for a in asset_rep['problems'][:10]:
    print('ASSET', a)
