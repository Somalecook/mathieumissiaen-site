# Builds the 6 static, indexable language versions of the Stickoo page from _i18n/template.html
#   /stickoo/      English (x-default)      /stickoo/fr/  /stickoo/ko/  /stickoo/ja/  /stickoo/zh/  /stickoo/es/
# run:  python3 stickoo/_i18n/build_pages.py
import json, os, re, html
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                       # .../stickoo
SITE = 'https://mathieumissiaen.fr'
LANGS = ['en', 'fr', 'es', 'ko', 'ja', 'zh']
PATH = {'en': '', 'fr': 'fr/', 'es': 'es/', 'ko': 'ko/', 'ja': 'ja/', 'zh': 'zh/'}
HREFLANG = {'en': 'en', 'fr': 'fr', 'es': 'es', 'ko': 'ko', 'ja': 'ja', 'zh': 'zh-Hans'}
OGLOC = {'en': 'en_US', 'fr': 'fr_FR', 'es': 'es_ES', 'ko': 'ko_KR', 'ja': 'ja_JP', 'zh': 'zh_CN'}
LABEL = {'en': 'EN', 'fr': 'FR', 'es': 'ES', 'ko': '한국어', 'ja': '日本語', 'zh': '中文'}
PLAY = 'https://play.google.com/store/apps/details?id=paris.iolo.stickoo'
APPSTORE = 'https://apps.apple.com/app/id6833900691'

T = json.load(open(os.path.join(HERE, 'strings.json'), encoding='utf-8'))
tpl = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()

def t(key, L):
    v = T[key]
    return v.get(L) or v['en']

def jsonld(L):
    url = SITE + '/stickoo/' + PATH[L]
    app = {
        '@type': ['MobileApplication', 'VideoGame'], 'name': 'Stickoo', 'alternateName': ['Stickoo game', 'Stickoo app'], 'url': url,
        'genre': ['Educational game', 'Language learning game', 'Kids game'], 'gamePlatform': ['Android', 'iOS'], 'playMode': 'SinglePlayer',
        'description': t('meta_desc', L), 'inLanguage': ['en', 'fr', 'es', 'ko', 'ja', 'zh'],
        'applicationCategory': 'EducationalApplication', 'applicationSubCategory': t('ld_subcat', L),
        'operatingSystem': 'Android, iOS', 'image': SITE + '/stickoo/assets/logo-kids.webp',
        'screenshot': [SITE + '/stickoo/assets/shot-%s.webp' % s for s in ('home', 'quiz', 'win', 'album', 'ach')],
        'audience': {'@type': 'PeopleAudience', 'suggestedMinAge': 3, 'suggestedMaxAge': 8},
        'educationalUse': t('ld_edu', L), 'isFamilyFriendly': True,
        'author': {'@type': 'Person', 'name': 'Mathieu Missiaen', 'url': SITE + '/'},
        'installUrl': [PLAY, APPSTORE], 'sameAs': [PLAY, APPSTORE],
    }
    faq = {'@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': html.unescape(re.sub('<[^>]+>', '', t('faq%d_q' % i, L))),
         'acceptedAnswer': {'@type': 'Answer', 'text': html.unescape(re.sub('<[^>]+>', '', t('faq%d_a' % i, L)))}} for i in range(1, 7)]}
    crumbs = {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Mathieu Missiaen', 'item': SITE + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'Stickoo', 'item': url}]}
    return json.dumps({'@context': 'https://schema.org', '@graph': [app, faq, crumbs]}, ensure_ascii=False)

def head(L):
    url = SITE + '/stickoo/' + PATH[L]
    alts = ''.join('<link rel="alternate" hreflang="%s" href="%s/stickoo/%s">\n' % (HREFLANG[x], SITE, PATH[x]) for x in LANGS)
    alts += '<link rel="alternate" hreflang="x-default" href="%s/stickoo/">\n' % SITE
    ogalt = ''.join('<meta property="og:locale:alternate" content="%s">\n' % OGLOC[x] for x in LANGS if x != L)
    return ('<title>{title}</title>\n<meta name="description" content="{desc}">\n<meta name="keywords" content="{kw}">\n'
            '<meta name="robots" content="index, follow, max-image-preview:large">\n<link rel="canonical" href="{url}">\n{alts}'
            '<meta property="og:type" content="website">\n<meta property="og:site_name" content="Stickoo">\n<meta property="og:url" content="{url}">\n'
            '<meta property="og:title" content="{title}">\n<meta property="og:description" content="{ogd}">\n'
            '<meta property="og:image" content="{site}/stickoo/assets/logo-kids.webp">\n<meta property="og:locale" content="{loc}">\n{ogalt}'
            '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{title}">\n<meta name="twitter:description" content="{ogd}">\n'
            '<meta name="twitter:image" content="{site}/stickoo/assets/logo-kids.webp">\n'
            '<meta name="apple-itunes-app" content="app-id=6833900691">\n<meta name="theme-color" content="#3d1d63">\n'
            '<link rel="icon" href="{site}/stickoo/assets/ic-stickers.webp">\n'
            '<script type="application/ld+json">{ld}</script>\n').format(
        title=html.escape(t('meta_title', L)), desc=html.escape(t('meta_desc', L)), kw=html.escape(t('meta_kw', L)),
        url=url, alts=alts, ogd=html.escape(t('og_desc', L)), site=SITE, loc=OGLOC[L], ogalt=ogalt, ld=jsonld(L))

def switcher(L):
    return '<nav class="lang" aria-label="Language">' + ''.join(
        '<a href="/stickoo/%s" hreflang="%s" lang="%s"%s>%s</a>' % (PATH[x], HREFLANG[x], HREFLANG[x], ' class="on" aria-current="page"' if x == L else '', LABEL[x])
        for x in LANGS) + '</nav>'

for L in LANGS:
    page = tpl.replace('{{HEAD}}', head(L)).replace('{{LANG}}', HREFLANG[L]).replace('{{SWITCHER}}', switcher(L))
    page = page.replace('{{PLAY}}', PLAY).replace('{{APPSTORE}}', APPSTORE).replace('{{PRIVACY}}', '/stickoo/confidentialite.html')
    page = page.replace('{{ROOT}}', '/stickoo/')
    page = page.replace('{{AUTOLANG}}', 'true' if L == 'en' else 'false')
    page = re.sub(r'\{\{([a-z0-9_]+)\}\}', lambda m: t(m.group(1), L), page)
    assert '{{' not in page, re.findall(r'\{\{[^}]*\}\}', page)[:5]
    out = os.path.join(ROOT, PATH[L], 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(page)
    print('wrote', out, len(page))
