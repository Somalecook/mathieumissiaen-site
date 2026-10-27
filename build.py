#!/usr/bin/env python3
"""Builds the SEO layer of mathieumissiaen.fr from content/*.json.

Runs on every Netlify deploy (see netlify.toml), so edits made in Pages CMS
are picked up automatically. It writes:
  - index.html, gallery.html, film.html, about.html, project.html, 404.html
  - work/<slug>/index.html  (one real, indexable page per project)
  - sitemap.xml, robots.txt
Each page gets a unique title, description, canonical URL, Open Graph /
Twitter tags, JSON-LD, and readable HTML content for crawlers; assets/site.js
then renders the full interactive page on top.
Only the Python standard library is used.
"""
import json, os, html, re, shutil, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE_URL = 'https://mathieumissiaen.fr'
TODAY = datetime.date.today().isoformat()


def load(name):
    with open(os.path.join(ROOT, 'content', name + '.json'), encoding='utf-8') as f:
        return json.load(f)


site, projects, films = load('site'), load('projects')['projects'], load('films')
SERVICES = load('services')['services'] if os.path.exists(os.path.join(ROOT, 'content', 'services.json')) else []
NAME = site['name']
C = site['contact']
e = lambda s: html.escape(str(s or ''), quote=True)
plain = lambda s: re.sub(r'<[^>]+>', '', str(s or '')).strip()
absu = lambda p: p if str(p).startswith('http') else SITE_URL + '/' + str(p).lstrip('/')


def ratio_wh(r, w=1200):
    try:
        a, b = [float(x) for x in str(r).split('/')]
        return w, int(round(w * b / a))
    except Exception:
        return w, int(w * 1.25)


def all_images(p):
    return [im for s in p.get('sections') or [] for im in s.get('images') or []]


def is_image(src):
    return str(src).lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif'))


def og_image(src):
    # social networks don't show animated webp: fall back to the first still image
    return absu(src)


PERSON = {
    '@type': 'Person', '@id': SITE_URL + '/#person', 'name': NAME, 'url': SITE_URL + '/',
    'jobTitle': 'Creative director, CGI artist, photographer and director',
    'description': site['about']['short'],
    'hasOccupation': [{'@type': 'Occupation', 'name': n, 'occupationLocation': {'@type': 'City', 'name': 'Paris'}} for n in
                      ['Creative director', 'CGI artist', '3D artist', 'Photographer', 'Film director']],
    'email': 'mailto:' + C.get('email', ''),
    'address': {'@type': 'PostalAddress', 'addressLocality': 'Paris', 'addressCountry': 'FR'},
    'sameAs': [u for u in [C.get('instagram'), C.get('vimeo'), C.get('tiktok'), C.get('iolo')] if u],
    'knowsAbout': ['Art direction', 'CGI', '3D', 'Houdini', 'Cinema 4D', 'Still life photography', 'Campaign photography',
                   'Film direction', 'Motion design', 'Generative AI', 'AI image making', 'Vibe coding', 'Creative coding'],
}

FONT_LINKS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
              '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
              '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">')


def nav_html():
    tabs = [p for p in projects if p.get('tab')]
    links = [('/', 'Work')] + [('/work/%s/' % p['slug'], p['tab']) for p in tabs] + \
            [('/gallery.html', 'Gallery'), ('/film.html', 'Moving image'), ('/about.html', 'About')] + \
            [('/' + k['href'].lstrip('/'), k['label']) for k in site.get('links', [])]
    return ('<header class="wrap site-head"><a href="/">%s</a><nav aria-label="Site">%s</nav></header>'
            % (e(NAME), ''.join('<a class="navlink" href="%s">%s</a>' % (h, e(t)) for h, t in links)))


def services_html():
    return ''.join('<a href="/services/%s/">%s</a>' % (s['slug'], e(s['label'])) for s in SERVICES)


def foot_html():
    return ('<footer class="wrap site-foot"><nav class="svc-links" aria-label="Services">%s</nav><a href="mailto:%s">%s</a> · <a href="%s" rel="me">Instagram</a> · '
            '<a href="%s" rel="me">Vimeo</a> · Paris</footer>' % (services_html(), e(C['email']), e(C['email']), e(C.get('instagram')), e(C.get('vimeo'))))


def page(path, title, desc, body_attrs, content, image, jsonld, og_type='website', robots='index, follow'):
    url = SITE_URL + '/' + path if path else SITE_URL + '/'
    url = url.replace('/index.html', '/')
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="{robots}">
<meta name="author" content="{e(NAME)}">
<link rel="canonical" href="{e(url)}">
<meta property="og:site_name" content="{e(NAME)}">
<meta property="og:type" content="{og_type}">
<meta property="og:url" content="{e(url)}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{e(og_image(image))}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{e(og_image(image))}">
<meta name="theme-color" content="#E9E8E4">
<link rel="icon" type="image/png" href="/images/sticker.png">
<link rel="apple-touch-icon" href="/images/sticker.png">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
{FONT_LINKS}
<link rel="stylesheet" href="assets/site.css">
<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>
</head>
<body {body_attrs}>
<main id="app">{nav_html()}<div class="wrap seo-pre">{content}</div>{foot_html()}</main>
<script src="assets/site.js"></script>
</body>
</html>
"""


def write(rel, text):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(text)


visible = [p for p in projects if not p.get('galleryOnly')]
default_img = (site.get('home', {}).get('latest', {}).get('items') or [{}])[0].get('src') or visible[0]['cover']
pages = []

# ---------- home ----------
home_desc = site.get('seo', {}).get('description') or site['about']['short']
lst = ''.join('<li><a href="/work/%s/">%s</a>%s%s</li>' % (
    p['slug'], e(p['title']), (' — ' + e(p['client'])) if p.get('client') else '', (' — ' + e(p['year'])) if p.get('year') else '') for p in visible)
home_content = ('<h1>%s — Image IRL &amp; CGI</h1><p>%s</p><h2>Services</h2><ul>%s</ul><h2>Selected work</h2><ul>%s</ul>'
                '<p>Clients: %s.</p>' % (e(NAME), e(home_desc), ''.join('<li><a href="/services/%s/">%s</a></li>' % (s['slug'], e(s['title'])) for s in SERVICES), lst, e(', '.join(site['about']['clients']))))
home_ld = {'@context': 'https://schema.org', '@graph': [
    PERSON,
    {'@type': 'WebSite', '@id': SITE_URL + '/#website', 'url': SITE_URL + '/', 'name': NAME, 'inLanguage': 'en', 'publisher': {'@id': SITE_URL + '/#person'}},
    {'@type': 'ItemList', 'name': 'Selected work', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'url': '%s/work/%s/' % (SITE_URL, p['slug']), 'name': p['title']} for i, p in enumerate(visible)]}]}
write('index.html', page('', site.get('seo', {}).get('title') or NAME, home_desc, 'data-page="home"', home_content, default_img, home_ld))
pages.append(('', '1.0'))

# ---------- projects ----------
for i, p in enumerate(visible):
    imgs = [im for im in all_images(p) if is_image(im['src'])]
    still = next((im['src'] for im in imgs if im['src'].lower().endswith(('.jpg', '.jpeg', '.png'))), p.get('cover'))
    who = (p['client'] + ' ') if p.get('client') and p['client'] not in p['title'] else ''
    what = (who + ('campaign' if p['kind'] == 'commission' else 'personal series')).strip()
    title = '%s — %s%s | %s' % (plain(p['title']), what, (', ' + ' &'.join(p['medium'].rsplit(',', 1))) if p.get('medium') else '', NAME)
    desc = plain(p.get('intro')) or ('%s by %s, %s.' % (p['title'], NAME, 'personal research' if p['kind'] == 'research' else 'commission'))
    figs = ''.join('<figure><img src="%s" alt="%s" width="%d" height="%d" loading="lazy"></figure>' % (
        e(im['src']), e('%s — %s%s by %s' % (plain(im.get('title')) or plain(p['title']), (p['client'] + ', ') if p.get('client') else '', (p.get('medium') or 'image').lower(), NAME)), *ratio_wh(im.get('ratio'))) for im in imgs[:24])
    credits = ''.join('<li>%s: %s</li>' % (e(c['role']), e(c['name'])) for c in p.get('credits') or [])
    content = ('<p><a href="/">Work</a> / %s</p><h1>%s</h1><p>%s</p>%s%s%s' % (
        'Research' if p['kind'] == 'research' else 'Commissions', e(plain(p['title'])), e(desc),
        ('<p>%s</p>' % e(p['year'])) if p.get('year') else '', ('<h2>Credits</h2><ul>%s</ul>' % credits) if credits else '', figs))
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'CreativeWork', 'name': plain(p['title']), 'url': '%s/work/%s/' % (SITE_URL, p['slug']),
         'description': desc, 'creator': {'@id': SITE_URL + '/#person'}, 'genre': 'Personal research' if p['kind'] == 'research' else 'Commission',
         'image': [absu(im['src']) for im in imgs[:10]], **({'dateCreated': p['year']} if re.match(r'^\d{4}$', str(p.get('year', ''))) else {}),
         **({'sourceOrganization': {'@type': 'Organization', 'name': p['client']}} if p.get('client') else {}),
         **({'keywords': p['medium']} if p.get('medium') else {})},
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Work', 'item': SITE_URL + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': plain(p['title']), 'item': '%s/work/%s/' % (SITE_URL, p['slug'])}]},
        PERSON]}
    write('work/%s/index.html' % p['slug'], page('work/%s/' % p['slug'], title, desc, 'data-page="project" data-slug="%s"' % e(p['slug']), content, still, ld, 'article'))
    pages.append(('work/%s/' % p['slug'], '0.8'))

# ---------- gallery ----------
gal_imgs = [(p, im) for p in projects if not p.get('tab') for im in all_images(p) if is_image(im['src'])]
gal = ''.join('<figure><img src="%s" alt="%s" loading="lazy"></figure>' % (e(im['src']), e(plain(im.get('title')) or plain(p['title']))) for p, im in gal_imgs[:60])
write('gallery.html', page('gallery.html', 'Gallery — ' + NAME, 'Images by %s: personal research, CGI studies and commissions for fashion, luxury and beauty houses, all in one gallery.' % NAME,
                           'data-page="gallery"', '<h1>Gallery</h1>' + gal, default_img,
                           {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Gallery', 'url': SITE_URL + '/gallery.html', 'author': {'@id': SITE_URL + '/#person'}}))
pages.append(('gallery.html', '0.7'))

# ---------- film ----------
F = films['films']
fl = ''.join('<li><a href="https://vimeo.com/%s">%s</a> — %s%s. %s</li>' % (f['vimeo'], e(f['title']), e(f['client']), (', ' + e(f['year'])) if f.get('year') else '', e(f.get('note'))) for f in F)
vids = [{'@type': 'VideoObject', 'name': '%s — %s' % (f['title'], f['client']), 'description': f.get('note') or f['title'],
         'thumbnailUrl': absu(f.get('thumb')), 'embedUrl': 'https://player.vimeo.com/video/%s' % f['vimeo'],
         'url': 'https://vimeo.com/%s' % f['vimeo'], **({'uploadDate': f['year'] + '-01-01'} if re.match(r'^\d{4}$', str(f.get('year', ''))) else {}),
         'duration': 'PT%dS' % int(f.get('duration') or 0), 'creator': {'@id': SITE_URL + '/#person'}} for f in F]
write('film.html', page('film.html', 'Moving image — ' + NAME, 'Films directed and produced by %s for %s.' % (NAME, ', '.join(dict.fromkeys(f['client'] for f in F if f.get('client') and not f['client'].startswith('with')))),
                        'data-page="film"', '<h1>Moving image</h1><ul>%s</ul>' % fl, F[0].get('thumb') or default_img,
                        {'@context': 'https://schema.org', '@graph': vids + [PERSON]}))
pages.append(('film.html', '0.7'))

# ---------- about ----------
A = site['about']
ab = '<h1>About %s</h1><p>%s</p>%s<h2>Selected clients</h2><p>%s</p><h2>Contact</h2><p><a href="mailto:%s">%s</a></p>' % (
    e(NAME), e(A['short']), ''.join('<p>%s</p>' % e(b) for b in A['bio']), e(', '.join(A['clients'])), e(C['email']), e(C['email']))
write('about.html', page('about.html', 'About — ' + NAME, A['short'], 'data-page="about"', ab, default_img,
                         {'@context': 'https://schema.org', '@type': 'ProfilePage', 'url': SITE_URL + '/about.html', 'mainEntity': PERSON}))
pages.append(('about.html', '0.6'))

# ---------- service pages (keyword landing pages) ----------
byslug = {p['slug']: p for p in visible}
for s in SERVICES:
    ps = [byslug[x] for x in s.get('projects', []) if x in byslug]
    cards = ''.join('<a class="svc-card" href="/work/%s/"><img src="%s" alt="%s" loading="lazy"><span>%s%s</span></a>' % (
        p['slug'], e(p['cover']), e('%s — %s by %s' % (plain(p['title']), (p.get('medium') or s['label']).lower(), NAME)), e(plain(p['title'])),
        (' <em>' + e(p['client']) + '</em>') if p.get('client') and p['client'].lower() not in plain(p['title']).lower() else '') for p in ps)
    fl2 = ''.join('<li><a href="/film.html">%s — %s</a>%s</li>' % (e(f['client']), e(f['title']), (' (' + e(f['year']) + ')') if f.get('year') else '') for f in F) if s.get('films') else ''
    links = ''.join('<li><a href="%s">%s</a></li>' % (e(k['href']), e(k['label'])) for k in s.get('links', []))
    others = ''.join('<a href="/services/%s/">%s</a>' % (o['slug'], e(o['label'])) for o in SERVICES if o is not s)
    content = ('<p class="svc-kicker">%s · Paris</p><h1>%s</h1><p class="svc-lead">%s</p>%s<p lang="fr" class="svc-fr">%s</p>'
               '%s%s%s<p><a class="pill" href="mailto:%s?subject=%s">Start a project →</a></p><p class="svc-others">Also: %s</p>') % (
        e(s['label']), e(s['title']), e(s['intro']), ''.join('<p>%s</p>' % e(x) for x in s.get('body', [])), e(s.get('fr', '')),
        ('<h2>Selected work</h2><div class="svc-grid">%s</div>' % cards) if cards else '',
        ('<h2>Films</h2><ul>%s</ul>' % fl2) if fl2 else '', ('<ul>%s</ul>' % links) if links else '',
        e(C['email']), e(s['label']), others)
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Service', 'name': s['title'], 'serviceType': s['label'], 'description': s['description'],
         'provider': {'@id': SITE_URL + '/#person'}, 'areaServed': ['Paris', 'France', 'Europe', 'Worldwide'],
         'url': '%s/services/%s/' % (SITE_URL, s['slug'])},
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': NAME, 'item': SITE_URL + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': s['label'], 'item': '%s/services/%s/' % (SITE_URL, s['slug'])}]},
        PERSON]}
    img = ps[0]['cover'] if ps else default_img
    write('services/%s/index.html' % s['slug'], page('services/%s/' % s['slug'], s['metaTitle'], s['description'], 'data-page="service"', content, img, ld))
    pages.append(('services/%s/' % s['slug'], '0.9'))

# ---------- legacy project.html#slug → /work/slug/ ----------
write('project.html', """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>%s</title>
<meta name="robots" content="noindex, follow"><link rel="canonical" href="%s/">
<script>var s=decodeURIComponent(location.hash.slice(1));location.replace(s?'/work/'+encodeURIComponent(s)+'/':'/');</script>
</head><body><a href="/">%s</a></body></html>
""" % (e(NAME), SITE_URL, e(NAME)))

# ---------- 404 ----------
write('404.html', page('404.html', 'Page not found — ' + NAME, 'This page does not exist.', 'data-page="notfound"',
                       '<h1>Page not found</h1><p><a href="/">Back to the work</a></p>', default_img, {'@context': 'https://schema.org', '@type': 'WebPage', 'name': 'Not found'},
                       robots='noindex, follow'))

# ---------- sitemap + robots ----------
extra = []
for rel in ['stickoo/index.html', 'stickoo/confidentialite.html']:
    if os.path.exists(os.path.join(ROOT, rel)):
        extra.append((rel.replace('index.html', ''), '0.5'))
urls = ''.join('<url><loc>%s/%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n' % (SITE_URL, u, TODAY, pr) for u, pr in pages + extra)
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls)
write('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /stickoo/app/\n\nSitemap: %s/sitemap.xml\n' % SITE_URL)

# remove pages of projects that no longer exist
wdir = os.path.join(ROOT, 'work')
for d in os.listdir(wdir):
    if d not in {p['slug'] for p in visible}:
        shutil.rmtree(os.path.join(wdir, d), ignore_errors=True)

print('built %d pages' % (len(pages) + len(extra)))
