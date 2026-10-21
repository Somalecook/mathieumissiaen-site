/* mathieumissiaen.fr — renders every page from the JSON files in /content.
   Edit content/*.json (or use /admin) to add, change or remove projects, films and texts. */
(function () {
  'use strict';
  var SHOW_CAP = false; // grey captions under images: set to true to bring them back

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function rich(s) { return esc(s).replace(/&lt;(\/?)em&gt;/g, '<$1em>'); } // allows <em> only
  function plain(s) { return String(s || '').replace(/<[^>]+>/g, ''); }
  function ratioNum(r) { var p = String(r || '4 / 5').split('/'); return parseFloat(p[0]) / parseFloat(p[1] || 1); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function getJSON(name) { return fetch('content/' + name + '.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(name); return r.json(); }); }
  var loadedFonts = {};
  function loadFont(spec) {
    if (!spec || loadedFonts[spec]) return;
    loadedFonts[spec] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + spec + '&display=swap';
    document.head.appendChild(l);
  }
  function allImages(p) {
    var out = [];
    (p.sections || []).forEach(function (s) { (s.images || []).forEach(function (im) { out.push(im); }); });
    return out;
  }
  function kindLabel(k) { return k === 'research' ? 'Research' : 'Commission'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---------- shell ----------
  function header(active, site) {
    var c = site.contact;
    function l(href, label, key) { return '<a class="navlink" href="' + href + '"' + (active === key ? ' aria-current="page"' : '') + '>' + label + '</a>'; }
    return '<header class="wrap site-head"><a href="index.html">' + esc(site.name) + '</a><nav aria-label="Site">' +
      l('index.html', 'Work', 'work') + (window.__TABS || []).map(function (t) { return l('project.html#' + t.slug, esc(t.tab), 'tab-' + t.slug); }).join('') + l('gallery.html', 'Gallery', 'gallery') + l('film.html', 'Moving image', 'film') + l('about.html', 'About', 'about') +
      '<span class="sep" aria-hidden="true"></span>' +
      '<a class="navlink" href="' + esc(c.instagram) + '" target="_blank" rel="noopener">Instagram ↗</a>' +
      (c.vimeo ? '<a class="navlink" href="' + esc(c.vimeo) + '" target="_blank" rel="noopener">Vimeo ↗</a>' : '') +
      (c.tiktok ? '<a class="navlink" href="' + esc(c.tiktok) + '" target="_blank" rel="noopener">TikTok ↗</a>' : '') +
      (c.iolo ? '<span class="sep" aria-hidden="true"></span><a class="navlink" href="' + esc(c.iolo) + '" target="_blank" rel="noopener" title="Objects — art direction by Mathieu Missiaen">iolo.paris ↗</a>' : '') +
      '</nav></header>';
  }
  function footer(site) {
    var m = site.contact.email;
    return '<section class="wrap mail-cta"><a class="mail-btn" href="mailto:' + esc(m) + '?subject=' + encodeURIComponent('Hello Mathieu') + '">Write to me <span aria-hidden="true">→</span></a><span class="mail">' + esc(m) + '</span></section>' +
      '<footer class="wrap site-foot"><span class="mail">' + esc(site.contact.email) + '</span>' + (site.contact.iolo ? '<a href="' + esc(site.contact.iolo) + '" target="_blank" rel="noopener">Also: iolo.paris — objects, art direction ↗</a>' : '') + '<span>© ' + new Date().getFullYear() + ' — Paris</span></footer>';
  }

  // ---------- lightbox ----------
  var LB = { list: [], i: 0, el: null };
  function lbInit() {
    var el = document.createElement('div');
    el.className = 'lb'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Image viewer');
    el.innerHTML = '<div class="bar"><span class="pos"></span><button type="button" class="x">Close ✕</button></div>' +
      '<div class="stage"><img alt=""></div>' +
      '<div class="bar"><button type="button" class="prev">← Prev</button><span class="txt" style="text-align:center"></span><button type="button" class="next">Next →</button></div>';
    document.body.appendChild(el);
    LB.el = el;
    $('.x', el).onclick = lbClose;
    $('.prev', el).onclick = function () { lbShow(LB.i - 1); };
    $('.next', el).onclick = function () { lbShow(LB.i + 1); };
    el.addEventListener('click', function (e) { if (e.target.classList.contains('stage')) lbClose(); });
    document.addEventListener('keydown', function (e) {
      if (LB.el.hidden) return;
      if (e.key === 'Escape') lbClose();
      if (e.key === 'ArrowLeft') lbShow(LB.i - 1);
      if (e.key === 'ArrowRight') lbShow(LB.i + 1);
    });
  }
  function lbOpen(list, i) { if (!LB.el) lbInit(); LB.list = list; LB.el.hidden = false; lbShow(i); $('.x', LB.el).focus(); }
  function lbClose() { LB.el.hidden = true; }
  function lbShow(i) {
    var n = LB.list.length; LB.i = (i + n) % n;
    var it = LB.list[LB.i];
    var img = $('.stage img', LB.el); img.src = it.src; img.alt = plain(it.title || '');
    $('.pos', LB.el).textContent = (LB.i + 1) + ' / ' + n;
    $('.txt', LB.el).innerHTML = '<span class="serif" style="font-size:18px">' + rich(it.title || '') + '</span>' + (SHOW_CAP && it.caption ? '<span style="color:#B3B0A9"> — ' + rich(it.caption) + '</span>' : '');
  }
  function bindZoom(root, list) {
    $$('[data-zoom]', root).forEach(function (n) {
      n.addEventListener('click', function () { lbOpen(list, +n.getAttribute('data-zoom')); });
    });
  }

  function bindPlayers(root) {
    $$('.player[data-film]', root).forEach(function (pl) {
      var im = $('img', pl);
      if (im) { im.onerror = function () { if (im.dataset.fallback && im.src.indexOf(im.dataset.fallback) < 0) im.src = im.dataset.fallback; }; if (im.complete && !im.naturalWidth) im.onerror(); }
      var b = $('.playbtn', pl); if (!b) return;
      b.onclick = function () {
        pl.innerHTML = '<iframe src="https://player.vimeo.com/video/' + pl.dataset.film + '?autoplay=1&title=0&byline=0&portrait=0&color=E9E8E4&dnt=1" allow="autoplay; fullscreen; picture-in-picture" title="Film"></iframe>';
      };
    });
  }

  function mixImages(all) {
    var groups = {};
    all.forEach(function (x) { (groups[x.slug] = groups[x.slug] || []).push(x); });
    Object.keys(groups).forEach(function (k) { var g = groups[k]; for (var n = g.length - 1; n > 0; n--) { var r = Math.floor(Math.random() * (n + 1)), t = g[n]; g[n] = g[r]; g[r] = t; } });
    var out = [], last = null, last2 = null;
    while (out.length < all.length) {
      var keys = Object.keys(groups).filter(function (k) { return groups[k].length; });
      var ok = keys.filter(function (k) { return k !== last && k !== last2; });
      if (!ok.length) ok = keys.filter(function (k) { return k !== last; });
      if (!ok.length) ok = keys;
      var tot = ok.reduce(function (a, k) { return a + groups[k].length; }, 0), r = Math.random() * tot, pick = ok[0];
      for (var m = 0; m < ok.length; m++) { r -= groups[ok[m]].length; if (r < 0) { pick = ok[m]; break; } }
      out.push(groups[pick].shift()); last2 = last; last = pick;
    }
    return out;
  }

  // ---------- HOME ----------
  var SLOTS = [
    { col: '2 / span 5', mt: 0 }, { col: '8 / span 4', mt: 220 }, { col: '1 / span 3', mt: 120 }, { col: '5 / span 8', mt: 40 },
    { col: '3 / span 4', mt: 160 }, { col: '9 / span 4', mt: 40 }, { col: '1 / span 6', mt: 100 }, { col: '8 / span 5', mt: 240 },
    { col: '4 / span 4', mt: 60 }, { col: '9 / span 4', mt: 180 }
  ];
  function renderHome(site, data) {
    var P = data.projects.filter(function (p) { return !p.tab && !p.galleryOnly; });
    var st = { kind: 'all', view: 'images' };
    var nR = P.filter(function (p) { return p.kind === 'research'; }).length, nC = P.length - nR;
    loadFont('Bodoni+Moda:ital,opsz,wght@1,6..96,400&family=Syne:wght@800&family=Silkscreen&family=Saira+Stencil+One');
    var F = (data.films && data.films.films) || [];
    var order = (site.home && site.home.features) || P.filter(function (p) { return p.feature; }).map(function (p) { return { type: 'project', slug: p.slug }; });
    var playIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#111110" stroke-width="2" stroke-linejoin="round"><path d="M7 4l13 8-13 8z"></path></svg>';

    function projectFeature(p, i, f) {
      var t = p.theme, imgs = f.images && f.images.length ? f.images.map(function (src) { return allImages(p).filter(function (im) { return im.src === src; })[0] || { src: src, title: '' }; }) : allImages(p).slice(0, 6);
      loadFont(t.font);
      var label = f.label || (p.kind === 'research' ? 'Series in focus — A / Research' : 'Commission in focus — B / Commissions');
      return '<section class="feature" style="background:' + t.bg + ';color:' + t.fg + '"><div class="wrap"><div class="feature-grid' + (i % 2 ? ' flip' : '') + '">' +
        '<div class="f-text">' + (f.label ? '<span style="color:' + t.muted + '">' + esc(f.label) + '</span>' : '') +
        (p.kicker ? '<span style="font-family:' + esc(t.fontCss) + ';font-size:22px;color:' + (t.accent || t.muted) + '">' + esc(p.kicker) + '</span>' : '') +
        '<a href="project.html#' + p.slug + '" ' + (p.displayLang ? 'lang="' + p.displayLang + '" ' : '') + 'style="font-family:' + esc(t.fontCss) + ';font-weight:' + t.titleWeight + ';font-style:' + (t.titleItalic ? 'italic' : 'normal') + ';font-size:' + (p.display.length > 6 ? 'clamp(44px,4.6vw,84px)' : 'clamp(56px,7vw,120px)') + ';line-height:.9;letter-spacing:' + (t.titleTracking || '-.02em') + ';overflow-wrap:break-word">' + esc(p.display) + '</a>' +
        (p.subtitle ? '<span class="serif" style="font-size:24px;line-height:1.15">' + (p.slug === 'tal' ? 'TAL — ' : '') + rich(p.subtitle) + '</span>' : '') +
        '<p style="margin:0;line-height:1.75;max-width:400px;opacity:.85">' + esc(f.text || p.intro) + '</p>' +
        '<a class="pill" href="project.html#' + p.slug + '">' + (p.kind === 'research' ? 'Enter the series →' : 'See the project →') + '</a></div>' +
        '<a class="f-imgs' + (imgs.length === 2 ? ' duo' : '') + '" href="project.html#' + p.slug + '" aria-label="' + esc(p.title) + '">' + imgs.map(function (im) {
          return '<img loading="lazy" src="' + im.src + '" alt="' + esc(plain(im.title)) + '" style="background:' + (im.bg || '#000') + '">';
        }).join('') + '</a></div></div></section>';
    }
    function filmFeature(fm, i, f) {
      loadFont('Big+Shoulders+Display:wght@300;800');
      var poster = fm.poster || fm.thumb, ratio = fm.format === '4:5' ? '4 / 5' : '16 / 9';
      return '<section class="feature" style="background:#33221A;color:#EFE9E1"><div class="wrap"><div class="feature-grid' + (i % 2 ? ' flip' : '') + '">' +
        '<div class="f-text">' + (f.label ? '<span style="color:#B8A99A">' + esc(f.label) + '</span>' : '') +
        '<span class="serif it" style="font-size:24px">' + esc(fm.client) + '</span>' +
        '<a href="film.html" style="font-family:\'Big Shoulders Display\',sans-serif;font-weight:800;font-size:clamp(64px,8vw,136px);line-height:.82;text-transform:uppercase">' + esc(fm.title) + '</a>' +
        '<p style="margin:0;line-height:1.75;max-width:400px;opacity:.85">' + esc(f.text || fm.note) + '</p>' +
        '<span style="display:flex;gap:10px;flex-wrap:wrap"><a class="pill" href="film.html">All films →</a><a class="pill" href="https://vimeo.com/' + fm.vimeo + '" target="_blank" rel="noopener">Vimeo ↗</a></span></div>' +
        '<div class="player" data-film="' + fm.vimeo + '" style="aspect-ratio:' + ratio + ';width:100%;align-self:center"><img src="' + poster + '" data-fallback="' + fm.thumb + '" alt="" style="opacity:.75"><button type="button" class="playbtn" aria-label="Play ' + esc(fm.title) + '">' + playIcon + '</button></div>' +
        '</div></div></section>';
    }
    var features = order.map(function (f, i) {
      if (f.type === 'film') { var fm = F.filter(function (x) { return x.vimeo === f.vimeo; })[0]; return fm ? filmFeature(fm, i, f) : ''; }
      var p = P.filter(function (x) { return x.slug === f.slug; })[0];
      return p ? projectFeature(p, i, f) : '';
    }).join('');

    var lab = site.lab.items.map(function (it) {
      var sq = it.image ? '<img loading="lazy" src="' + it.image + '" alt="">' :
        '<div style="height:100%;background:#141414;display:flex;flex-direction:column;justify-content:space-between;padding:14px"><span style="display:flex;height:6px"><span style="flex:1;background:#F4F3EF"></span><span style="flex:1;background:#1F4FBF"></span><span style="flex:1;background:#6B2FA3"></span><span style="flex:1;background:#6B4226"></span><span style="flex:.6;background:#C8102E"></span></span><span style="font-family:\'Saira Stencil One\',sans-serif;font-size:34px;line-height:.9;color:#E9E8E4">Rash<br>Lab</span></div>';
      return '<a href="' + it.href + '" style="display:flex;flex-direction:column;gap:10px"><div class="sq">' + sq + '</div><span>' + esc(it.title) + '</span><span style="color:#9C9991">' + esc(it.meta) + '</span></a>';
    }).join('');

    var c = site.contact;
    document.getElementById('app').innerHTML = header('work', site) +
      (function () {
        var L = site.home && site.home.latest;
        var title = '<div class="hero-wrap"><p class="hero-title">Image <em>IRL</em><br>&amp; <em>CGI</em></p><img class="sticker" src="images/sticker.png" alt="" width="108" height="132"></div>';
        var items = L && (L.items || (L.src ? [L] : []));
        if (!items || !items.length) return '<section class="wrap" style="padding-block:112px 96px">' + title + '</section>';
        loadFont('Gowun+Dodum');
        return '<section class="wrap latest' + (items.length > 1 ? ' duo' : '') + '"><div class="latest-text">' + title +
          '<div class="latest-cap">' + items.map(function (it) {
            return '<div style="display:flex;flex-direction:column;gap:8px"><span' + (it.lang ? ' lang="' + esc(it.lang) + '"' : '') + ' style="font-family:' + (it.lang === 'ko' ? '\'Gowun Dodum\',sans-serif' : 'var(--serif)') + ';font-size:clamp(28px,2.6vw,42px);line-height:1">' + esc(it.title) + '</span>' +
              (it.text ? '<p style="margin:0;max-width:360px;line-height:1.7">' + esc(it.text) + '</p>' : '') + '</div>';
          }).join('') + '</div></div>' +
          '<div class="latest-imgs">' + items.map(function (it) {
            var tag = it.href ? 'a' : 'div';
            return '<' + tag + ' class="latest-img"' + (it.href ? ' href="' + esc(it.href) + '"' : '') + ' style="aspect-ratio:' + esc(it.ratio || '4 / 5') + '"><img src="' + esc(it.src) + '" alt="' + esc(it.title) + '"></' + tag + '>';
          }).join('') + '</div></section>';
      })() +
      features +
      (function () {
        var cs = P.filter(function (p) { return p.kind === 'commission'; });
        if (!cs.length) return '';
        var card = function (p, clone) {
          var cover = p.cover || (allImages(p)[0] || {}).src;
          return '<a class="car-card" href="project.html#' + p.slug + '"' + (clone ? ' aria-hidden="true" tabindex="-1"' : '') + '><div class="car-ph"><img loading="lazy" src="' + cover + '" alt=""></div>' +
            '<span class="car-name">' + esc(p.title) + '</span></a>';
        };
        return '<section class="car" aria-label="Commissions"><div class="wrap"><div class="car-head"><span style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:clamp(28px,3.4vw,48px);letter-spacing:-.04em;line-height:1">Commissions</span>' +
          '<span class="car-nav"><button type="button" class="tog car-prev" aria-label="Previous">←</button><button type="button" class="tog car-next" aria-label="Next">→</button></span></div>' +
          '<div class="car-view"><div class="car-track">' + cs.map(function (p) { return card(p, false); }).join('') + cs.slice(0, 3).map(function (p) { return card(p, true); }).join('') + '</div></div></div></section>';
      })() +
      (function () {
        var A = site.home && site.home.app; if (!A || A.show === false) return '';
        loadFont('Fredoka:wght@500;700');
        return '<section class="app-sec"><div class="wrap"><div class="app-grid">' +
          '<div class="app-text"><span class="app-kicker">' + esc(A.meta || '') + '</span>' + (A.logo ? '<h2 class="app-logo"><img src="' + esc(A.logo) + '" alt="' + esc(A.title) + '"></h2>' : '<h2 class="app-title">' + esc(A.title) + '</h2>') +
          (A.tagline ? '<p class="app-tag">' + esc(A.tagline) + '</p>' : '') + '<p class="app-desc">' + esc(A.text) + '</p></div>' +
          '<div class="app-stage">' + (A.cloud ? '<img class="app-cloud" src="' + esc(A.cloud) + '" alt="">' : '') +
          (A.sound ? '<img class="app-sound" src="' + esc(A.sound) + '" alt="">' : '') + '<video class="app-video" src="' + esc(A.video) + '" poster="' + esc(A.poster || '') + '" autoplay muted loop playsinline style="aspect-ratio:' + esc(A.ratio || '9 / 16') + '"></video></div></div>' +
          (A.stickers && A.stickers.length ? '<div class="app-stickers">' + A.stickers.map(function (s) { return '<img loading="lazy" src="' + esc(s) + '" alt="Stickoo stickers">'; }).join('') + '</div>' : '') +
          '</div></section>';
      })() +
      '<section class="wrap" style="padding-top:120px"><div class="panels rule">' +
      '<button type="button" class="panel" data-kind="research"><span style="font-family:\'Bodoni Moda\',serif;font-style:italic;font-size:clamp(40px,11vw,64px);line-height:1">Research</span><span style="line-height:1.7;max-width:440px">' + esc(site.panels.research) + '</span></button>' +
      '<button type="button" class="panel" data-kind="commission"><span style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:clamp(26px,8vw,54px);line-height:1;letter-spacing:-.04em">Commissions</span><span style="line-height:1.7;max-width:440px">' + esc(site.panels.commission) + '</span></button>' +
      '</div></section>' +
      '<section class="wrap" id="work" style="padding-top:104px;padding-bottom:24px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center">' +
      '<span class="muted" id="wallHead"></span><span style="display:flex;gap:2px;flex-wrap:wrap">' +
      '<button type="button" class="tog" data-k="all">All</button><button type="button" class="tog" data-k="research">Research</button><button type="button" class="tog" data-k="commission">Commissions</button>' +
      '<span class="sep" style="align-self:center"></span><button type="button" class="tog" data-v="images">Images</button><button type="button" class="tog" data-v="index">Index</button></span></section>' +
      '<section class="wrap" style="padding-bottom:200px" id="wallBox"></section>' +
      (site.lab && site.lab.show !== false ? '<section id="lab" style="background:#161513;color:#E9E8E4"><div class="wrap" style="padding-block:96px 112px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;margin-bottom:48px"><h2 style="margin:0;font-family:\'Silkscreen\',monospace;font-weight:400;font-size:80px;line-height:1">Lab</h2><p style="margin:0;max-width:420px;line-height:1.7;color:#B3B0A9">' + esc(site.lab.intro) + '</p></div>' +
      '<div class="lab">' + lab + '</div></div></section>' : '') +
      '<section class="wrap ig" id="ig" style="padding-top:112px"><div class="ig-head"><span style="display:flex;flex-direction:column;gap:6px"><span class="muted">Live from Instagram</span><a href="' + esc(c.instagram) + '" target="_blank" rel="noopener" class="serif" style="font-size:clamp(32px,3.4vw,52px);line-height:1">' + esc(c.instagramHandle) + '</a></span><a class="pill" href="' + esc(c.instagram) + '" target="_blank" rel="noopener">Follow ↗</a></div><div class="ig-grid" id="igGrid"></div></section>' +
      '<section class="wrap" style="padding-block:120px 64px"><div class="split rule" style="padding-top:24px"><span></span><div style="display:flex;flex-direction:column;gap:24px">' +
      (site.info ? '<p class="serif" style="margin:0;font-size:34px;line-height:1.15">' + esc(site.info) + '</p>' : '') +
      '<a href="about.html" style="border-bottom:1px solid currentColor;align-self:flex-start">About →</a></div>' +
      '<div style="display:flex;flex-direction:column;gap:10px"><span class="mail">' + esc(c.email) + '</span><a href="' + esc(c.instagram) + '" target="_blank" rel="noopener">Instagram ' + esc(c.instagramHandle) + ' ↗</a>' + (c.vimeo ? '<a href="' + esc(c.vimeo) + '" target="_blank" rel="noopener">Vimeo ↗</a>' : '') + (c.iolo ? '<a href="' + esc(c.iolo) + '" target="_blank" rel="noopener">iolo.paris — objects ↗</a>' : '') + '</div></div></section>' +
      footer(site);

    function drawWall() {
      var list = P.filter(function (p) { return st.kind === 'all' || p.kind === st.kind; });
      $('#wallHead').textContent = st.kind === 'all' ? 'All work' : (st.kind === 'research' ? 'Research' : 'Commissions');
      $$('.tog[data-k]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === st.kind)); });
      $$('.tog[data-v]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === st.view)); });
      $$('.panel').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kind === st.kind)); });
      var box = $('#wallBox');
      if (st.view === 'images') {
        var ims = mixImages(data.projects.filter(function (p) { return !p.tab && (st.kind === 'all' || p.kind === st.kind); }).reduce(function (acc, p) {
          allImages(p).forEach(function (im) { acc.push({ src: im.src, ratio: im.ratio, bg: im.bg, slug: p.slug, p: p }); }); return acc;
        }, []));
        box.innerHTML = '<div class="wall">' + ims.map(function (x) {
          var p = x.p, tag = p.galleryOnly ? 'div' : 'a';
          return '<' + tag + ' class="w"' + (p.galleryOnly ? '' : ' href="project.html#' + p.slug + '"') + '><div class="ph" style="aspect-ratio:' + (x.ratio || '4 / 5') + ';background:' + (x.bg || '#D2D0CA') + '"><img loading="lazy" src="' + x.src + '" alt="' + esc(p.title) + '"></div>' +
            '<span class="w-cap"><span>' + esc(p.title) + '</span>' + (p.client && p.kind === 'commission' ? '<span class="serif it">' + esc(p.client) + '</span>' : '') + '</span></' + tag + '>';
        }).join('') + '</div>';
      } else {
        box.innerHTML = '<div class="rule">' + list.map(function (p, i) {
          return '<a class="idx-row" href="project.html#' + p.slug + '"><span style="width:40px" class="muted">' + pad(i + 1) + '</span><span class="serif" style="flex:1 1 360px;font-size:34px;line-height:1.05">' + esc(p.title) + (p.client && p.kind === 'commission' ? ', <span class="it">for ' + esc(p.client) + '</span>' : '') + '</span><span style="width:70px;text-align:right">' + esc(p.year) + '</span></a>';
        }).join('') + '</div>';
      }
    }
    $$('.tog[data-k]').forEach(function (b) { b.onclick = function () { st.kind = b.dataset.k; drawWall(); }; });
    $$('.tog[data-v]').forEach(function (b) { b.onclick = function () { st.view = b.dataset.v; drawWall(); }; });
    $$('.panel').forEach(function (b) { b.onclick = function () { st.kind = st.kind === b.dataset.kind ? 'all' : b.dataset.kind; drawWall(); $('#work').scrollIntoView({ behavior: 'smooth' }); }; });
    drawWall();
    (function () {
      // Instagram live feed: set contact.instagramFeed to a JSON feed URL (e.g. from behold.so)
      var box = $('#igGrid'), url = c.instagramFeed;
      if (!box) return;
      if (!url) { box.parentNode.classList.add('ig-empty'); return; }
      fetch(url).then(function (r) { return r.json(); }).then(function (d) {
        var posts = (Array.isArray(d) ? d : (d.posts || d.data || [])).slice(0, c.instagramCount || 8);
        if (!posts.length) throw new Error('empty');
        box.innerHTML = posts.map(function (q) {
          var img = (q.sizes && q.sizes.medium && q.sizes.medium.mediaUrl) || q.thumbnailUrl || q.thumbnail_url || q.mediaUrl || q.media_url;
          var link = q.permalink || c.instagram, cap = q.prunedCaption || q.caption || '';
          var vid = /VIDEO|REEL/i.test(q.mediaType || q.media_type || '');
          return '<a class="ig-post" href="' + esc(link) + '" target="_blank" rel="noopener" title="' + esc(plain(cap).slice(0, 120)) + '"><img loading="lazy" src="' + esc(img) + '" alt="' + esc(plain(cap).slice(0, 120)) + '">' + (vid ? '<span class="badge" style="right:8px">▶</span>' : '') + '</a>';
        }).join('');
      }).catch(function () { box.parentNode.classList.add('ig-empty'); });
    })();
    (function () {
      var car = $('.car'); if (!car) return;
      var track = $('.car-track', car), cards = $$('.car-card', car), n = cards.length - 3, i = 0, timer = null;
      if (n < 1) return;
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      function step() { return cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left; }
      function go(k, anim) {
        track.style.transition = anim === false || reduce ? 'none' : 'transform .9s cubic-bezier(.6,0,.2,1)';
        i = k; track.style.transform = 'translateX(' + (-i * step()) + 'px)';
      }
      track.addEventListener('transitionend', function () { if (i >= n) go(0, false); });
      function next() { if (i >= n) go(0, false); requestAnimationFrame(function () { go(i + 1); }); }
      function prev() { if (i <= 0) go(n, false); requestAnimationFrame(function () { go(i - 1); }); }
      function start() { stop(); if (!reduce) timer = setInterval(next, 3200); }
      function stop() { if (timer) clearInterval(timer); timer = null; }
      $('.car-next', car).onclick = function () { next(); start(); };
      $('.car-prev', car).onclick = function () { prev(); start(); };
      car.addEventListener('mouseenter', stop); car.addEventListener('mouseleave', start);
      car.addEventListener('focusin', stop); car.addEventListener('focusout', start);
      window.addEventListener('resize', function () { go(i, false); });
      start();
    })();
    $$('.player[data-film]').forEach(function (pl) {
      var im = $('img', pl); im.onerror = function () { if (im.dataset.fallback && im.src.indexOf(im.dataset.fallback) < 0) im.src = im.dataset.fallback; };
      if (im.complete && !im.naturalWidth) im.onerror();
      $('.playbtn', pl).onclick = function () {
        pl.innerHTML = '<iframe src="https://player.vimeo.com/video/' + pl.dataset.film + '?autoplay=1&title=0&byline=0&portrait=0&color=E9E8E4&dnt=1" allow="autoplay; fullscreen; picture-in-picture" title="Film"></iframe>';
      };
    });
  }

  // ---------- PROJECT ----------
  function renderProject(site, data) {
    var P = data.projects;
    var slug = decodeURIComponent(location.hash.slice(1)) || P[0].slug;
    var p = P.filter(function (x) { return x.slug === slug; })[0];
    if (!p) { document.getElementById('app').innerHTML = header('work', site) + '<section class="wrap" style="padding-block:120px"><p class="serif" style="font-size:40px">This project does not exist (anymore).</p><a class="pill" href="index.html">← All work</a></section>' + footer(site); return; }
    var t = p.theme, root = document.documentElement;
    loadFont(t.font);
    root.style.setProperty('--bg', t.bg); root.style.setProperty('--fg', t.fg); root.style.setProperty('--muted', t.muted); root.style.setProperty('--line', t.line);
    root.style.setProperty('--panel', t.line);
    root.style.setProperty('--title-font', t.fontCss); root.style.setProperty('--title-weight', t.titleWeight || 400);
    root.style.setProperty('--title-style', t.titleItalic ? 'italic' : 'normal'); root.style.setProperty('--title-tracking', t.titleTracking || '-.02em');
    document.title = plain(p.title) + ' — ' + site.name;
    var view = 'seq', imgs = allImages(p);
    var hasSeq = (p.sections || []).some(function (s) { return s.layout === 'sequence'; });
    var same = P.filter(function (x) { return x.kind === p.kind && !x.galleryOnly && (!x.tab || x === p); });
    var next = same[(same.indexOf(p) + 1) % same.length];
    if (next === p) next = P[(P.indexOf(p) + 1) % P.length];

    function sectionHTML(s, base) {
      var inner = '';
      if (s.layout === 'loop') {
        inner = '<div style="display:flex;justify-content:center"><video src="' + esc(s.src) + '" poster="' + esc(s.poster || '') + '" autoplay muted loop playsinline style="display:block;height:min(88vh,1100px);max-width:100%;aspect-ratio:' + (s.ratio || '16 / 9') + ';background:#000"></video></div>';
      } else if (s.layout === 'video') {
        inner = '<div class="player" data-film="' + esc(s.vimeo) + '" style="aspect-ratio:' + (s.ratio || '16 / 9') + ';width:100%"><img src="' + esc(s.poster || s.fallback || '') + '" data-fallback="' + esc(s.fallback || '') + '" alt="" style="opacity:.85"><button type="button" class="playbtn" aria-label="Play the film"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#111110" stroke-width="2" stroke-linejoin="round"><path d="M7 4l13 8-13 8z"></path></svg></button></div>';
      } else if (s.layout === 'hero') {
        inner = s.images.map(function (im, i) {
          return (ratioNum(im.ratio) > 1.2 ? '<figure style="margin:0;display:flex;flex-direction:column;gap:16px" class="hero-fig"><div style="width:100%;aspect-ratio:' + im.ratio + ';' : '<figure style="margin:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end" class="hero-fig"><div style="height:min(92vh,1100px);aspect-ratio:' + im.ratio + ';max-width:100%;') + 'background:' + (im.bg || '#000') + ';overflow:hidden"><img data-zoom="' + (base + i) + '" src="' + im.src + '" alt="' + esc(plain(im.title)) + '" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in"></div>' +
            (im.title ? '<figcaption class="cap" style="max-width:300px"><span class="t">' + rich(im.title) + '</span>' + (SHOW_CAP && im.caption ? '<span style="opacity:.8;line-height:1.7">' + rich(im.caption) + '</span>' : '') + (SHOW_CAP && im.tag ? '<span class="muted">' + esc(im.tag) + '</span>' : '') + '</figcaption>' : '') + '</figure>';
        }).join('');
      } else if (s.layout === 'sequence' && view === 'seq') {
        inner = '<div style="display:flex;flex-direction:column;gap:120px">' + s.images.map(function (im, i) {
          var idx = base + i, flip = i % 2 === 1, r = ratioNum(im.ratio), wide = r > 1.2;
          var no = '<span class="no">' + pad(idx + 1) + '</span>';
          var cap = '<div class="cap">' + no + '<span class="t">' + rich(im.title) + '</span>' + (SHOW_CAP && im.caption ? '<span style="opacity:.8;line-height:1.7">' + rich(im.caption) + '</span>' : '') + (SHOW_CAP && im.tag ? '<span class="muted">' + esc(im.tag) + '</span>' : '') + '</div>';
          var frame = function (h) { return '<div class="frame" style="' + h + ';background:' + (im.bg || '#000') + '"><img loading="lazy" data-zoom="' + idx + '" src="' + im.src + '" alt="' + esc(plain(im.title)) + '"></div>'; };
          if (im.detail) {
            return '<article class="seq">' +
              '<div style="grid-column:' + (flip ? '7' : '1') + ' / span 6;grid-row:1">' + frame('aspect-ratio:' + im.ratio + ';width:100%') + '</div>' +
              '<div style="grid-column:' + (flip ? '4' : '7') + ' / span 3;grid-row:1"><div class="frame" style="aspect-ratio:404 / 600;background:#000"><img loading="lazy" src="' + im.detail + '" alt="' + esc(plain(im.title)) + ' — detail in motion" style="object-fit:cover;cursor:default"></div></div>' +
              '<div style="grid-column:' + (flip ? '1 / span 3' : '10 / span 3') + ';grid-row:1">' + cap + '</div></article>';
          }
          if (wide) return '<article class="seq"><div style="grid-column:1 / span 9;grid-row:1">' + frame('aspect-ratio:' + im.ratio + ';width:100%') + '</div><div style="grid-column:10 / span 3;grid-row:1">' + cap + '</div></article>';
          return '<article class="seq"><div style="grid-column:' + (flip ? '6 / span 7' : '1 / span 7') + ';grid-row:1">' + frame('height:min(78vh,760px);aspect-ratio:' + im.ratio + (flip ? ';margin-left:auto' : '')) + '</div>' +
            '<div style="grid-column:' + (flip ? '1 / span 4' : '9 / span 4') + ';grid-row:1">' + cap + '</div></article>';
        }).join('') + '</div>';
      } else {
        var cols = s.layout === 'sequence' ? 3 : (s.columns || 3);
        inner = '<div class="grid" style="grid-template-columns:' + (s.template && view !== 'grid' ? s.template.split(' ').map(function (x) { return 'minmax(0,' + x + ')'; }).join(' ') : 'repeat(' + cols + ',minmax(0,1fr))') + ';align-items:end">' + s.images.map(function (im, i) {
          var r = s.layout === 'sequence' ? '4 / 5' : im.ratio;
          return '<figure><div style="aspect-ratio:' + r + ';overflow:hidden;background:' + (im.bg || '#000') + '"><img loading="lazy" data-zoom="' + (base + i) + '" src="' + im.src + '" alt="' + esc(plain(im.title)) + '" style="width:100%;height:100%;object-fit:' + (s.layout === 'sequence' ? 'cover' : 'cover') + '"></div>' +
            (im.title ? '<figcaption style="display:flex;justify-content:space-between;gap:12px"><span' + (s.title || s.captions ? ' style="font-family:var(--title-font);font-size:20px"' : '') + '>' + rich(im.title) + '</span><span class="muted">' + rich(SHOW_CAP && im.caption && (s.title || s.captions) ? im.caption : '') + '</span></figcaption>' : '') + '</figure>';
        }).join('') + '</div>';
      }
      var head = s.title ? '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;margin-bottom:48px"><h2 style="margin:0;font-family:var(--title-font);font-weight:var(--title-weight);font-style:var(--title-style);letter-spacing:var(--title-tracking);font-size:clamp(48px,6vw,96px);line-height:.9">' + rich(s.title) + '</h2>' + (s.intro ? '<p style="margin:0;max-width:380px;line-height:1.75">' + rich(s.intro) + '</p>' : '') + '</div>' : '';
      if (s.bg) return '<section style="background:' + s.bg + ';color:' + (s.fg || 'inherit') + '"><div class="wrap" style="padding-block:88px 104px">' + head + inner + '</div></section>';
      return '<section class="wrap" style="padding-block:24px 96px">' + head + inner + '</section>';
    }

    function draw() {
      var base = 0;
      var sections = (p.sections || []).map(function (s) { var h = sectionHTML(s, base); base += s.images.length; return h; }).join('');
      if (p.view === 'masonry') sections = '<section class="wrap" style="padding-bottom:120px"><div class="masonry">' + imgs.map(function (im, i) {
        return '<figure class="tile"><button type="button" data-zoom="' + i + '" aria-label="Open ' + esc(plain(im.title) || p.title) + '" style="background:' + (im.bg || 'var(--panel)') + '"><img loading="lazy" src="' + im.src + '" alt="' + esc(plain(im.title)) + '"></button></figure>';
      }).join('') + '</div></section>';
      var ch = p.chapters;
      var chapters = ch ? '<section style="background:' + ch.bg + ';color:' + ch.fg + ';--ch-line:' + ch.line + '"><div class="wrap" style="padding-block:96px 104px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;margin-bottom:56px"><h2 class="serif" style="margin:0;font-weight:400;font-size:clamp(44px,5vw,76px);line-height:1">' + rich(ch.title) + '</h2><p style="margin:0;max-width:380px;line-height:1.75;color:' + ch.muted + '">' + rich(ch.intro) + '</p></div>' +
        '<ol class="chapters" style="border-top:1px solid ' + ch.line + '">' + ch.items.map(function (it) {
          return '<li><span style="color:' + ch.muted + '">' + esc(it.label) + '</span><span class="serif" style="font-size:30px;line-height:1.05">' + rich(it.title) + '</span><span style="line-height:1.75;color:' + ch.muted + '">' + rich(it.text) + '</span></li>';
        }).join('') + '</ol></div></section>' : '';
      var essay = p.essay ? '<section class="wrap" style="padding-block:112px 64px"><div class="split"><span class="muted">' + esc(p.essay.label) + '</span><div style="display:flex;flex-direction:column;gap:24px"><p class="serif" style="margin:0;font-size:clamp(26px,2.4vw,36px);line-height:1.2">' + rich(p.essay.lead) + '</p>' + (p.essay.text ? '<p style="margin:0;font-size:13px;line-height:1.8;opacity:.85">' + rich(p.essay.text) + '</p>' : '') + '</div><span></span></div></section>' : '';
      var credits = (p.credits && p.credits.length) ? '<section class="wrap" style="padding-block:64px 48px"><div class="rule" style="padding-top:20px;display:flex;flex-direction:column;gap:28px"><span class="serif" style="font-size:34px">Credits</span><div class="credits">' + p.credits.map(function (c) { return '<div><span class="muted">' + esc(c.role) + '</span><span>' + esc(c.name) + '</span></div>'; }).join('') + '</div></div></section>' : '';
      var t3 = p.kind === 'commission' ? (p.client ? ['Client', p.client] : ['Type', 'Commission']) : ['Status', p.year === 'Ongoing' ? 'Ongoing — updated often' : 'Personal research'];
      document.getElementById('app').innerHTML = header(p.tab ? 'tab-' + p.slug : 'work', site) +
        '<section class="wrap" style="padding-block:56px 72px"><div class="crumb"><a href="index.html">← Work</a></div>' +
        (p.kicker ? '<div style="font-family:var(--title-font);font-size:clamp(22px,2.2vw,32px);color:' + (t.accent || 'var(--muted)') + ';margin-bottom:14px">' + esc(p.kicker) + '</div>' : '') +
        '<h1 class="p-title"' + (p.displayLang ? ' lang="' + p.displayLang + '"' : '') + '>' + esc(p.display) + '</h1>' +
        '<div class="p-intro" style="margin-top:40px"><div style="display:flex;flex-direction:column;gap:14px">' +
        (p.subtitle ? '<p class="serif" style="margin:0;font-size:clamp(28px,3vw,44px);line-height:1.05">' + (p.slug === 'tal' ? 'TAL — ' : '') + rich(p.subtitle) + '</p>' : '') +
        (p.tagline ? '<p class="serif it" style="margin:0;font-size:22px;opacity:.8">' + rich(p.tagline) + '</p>' : '') + '</div>' +
        '<p style="margin:0;font-size:14px;line-height:1.7;max-width:560px">' + rich(p.intro) + (p.year && p.year !== 'Ongoing' ? ' <span class="muted">' + esc(p.year) + '</span>' : '') + '</p></div>' +
        '</section>' +
        (hasSeq && p.view !== 'masonry' ? '<section class="wrap" style="padding-bottom:32px"><div class="rule-soft" style="padding-top:10px;display:flex;justify-content:flex-end;gap:2px"><button type="button" class="tog" data-view="seq" aria-pressed="' + (view === 'seq') + '">Sequence</button><button type="button" class="tog" data-view="grid" aria-pressed="' + (view === 'grid') + '">Grid</button></div></section>' : '') +
        sections + chapters + essay + credits +
        '<section class="wrap" style="padding-block:24px 0"><div class="rule" style="padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap"><a class="navlink" href="index.html" style="padding:0">← All work</a>' +
        '<a href="project.html#' + next.slug + '" style="display:flex;flex-direction:column;align-items:flex-end;gap:8px"><span class="serif" style="font-size:clamp(36px,4vw,60px);line-height:1">' + esc(next.display) + ' →</span></a></div></section>' +
        footer(site);
      $$('.tog[data-view]').forEach(function (b) { b.onclick = function () { view = b.dataset.view; draw(); }; });
      bindZoom(document.getElementById('app'), imgs);
      bindPlayers(document.getElementById('app'));
    }
    draw();
    window.scrollTo(0, 0);
  }

  // ---------- GALLERY ----------
  function renderGallery(site, data) {
    var items = [];
    data.projects.filter(function (p) { return !p.tab; }).forEach(function (p) { allImages(p).forEach(function (im) { items.push({ only: !!p.galleryOnly, src: im.src, title: p.title, sub: plain(im.title), caption: im.caption, kind: p.kind, slug: p.slug, year: p.year }); }); });
    items = mixImages(items);
    var st = { k: 'all' };
    function draw() {
      var list = items.filter(function (x) { return st.k === 'all' || x.kind === st.k; });
      var c = function (k) { return k === 'all' ? items.length : items.filter(function (x) { return x.kind === k; }).length; };
      document.getElementById('app').innerHTML = header('gallery', site) +
        '<section class="wrap" style="padding-block:96px 56px;display:flex;justify-content:space-between;align-items:flex-end;gap:32px;flex-wrap:wrap"><h1 style="margin:0;font-family:\'Unbounded\',sans-serif;font-weight:300;font-size:clamp(56px,9vw,140px);line-height:.9;letter-spacing:-.04em">Gallery</h1></section>' +
        '<section class="wrap" style="padding-bottom:40px"><div class="rule" style="padding-top:14px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap"><span>' +
        ['all', 'research', 'commission'].map(function (k) { return '<button type="button" class="tog" data-k="' + k + '" aria-pressed="' + (st.k === k) + '">' + (k === 'all' ? 'All' : k === 'research' ? 'Research' : 'Commissions') + '</button>'; }).join('') +
        '</span></div></section>' +
        '<section class="wrap" style="padding-bottom:120px"><div class="masonry">' + list.map(function (x, i) {
          return '<figure class="tile"><button type="button" data-zoom="' + i + '" aria-label="Open ' + esc(x.title) + '"><img loading="lazy" src="' + x.src + '" alt="' + esc(x.title + ' — ' + x.sub) + '"></button>' +
            '<figcaption class="w-cap">' + (x.only ? '<span>' + esc(x.title) + '</span>' : '<a href="project.html#' + x.slug + '">' + esc(x.title) + '</a>') + '</figcaption></figure>';
        }).join('') + '</div></section>' + footer(site);
      $$('.tog[data-k]').forEach(function (b) { b.onclick = function () { st.k = b.dataset.k; draw(); }; });
      bindZoom(document.getElementById('app'), list.map(function (x) { return { src: x.src, title: x.title + ' — ' + x.sub, caption: x.caption }; }));
    }
    loadFont('Unbounded:wght@300');
    draw();
  }

  // ---------- FILM ----------
  function renderFilm(site, data) {
    var F = data.films, st = { now: F.filter(function (f) { return f.vimeo === data.default; })[0] || F[0], k: 'all', playing: false };
    var fmt = function (s) { return Math.floor(s / 60) + ':' + pad(s % 60); };
    var total = F.reduce(function (a, f) { return a + f.duration; }, 0);
    var yrs = F.map(function (f) { return parseInt(f.year, 10); }).filter(function (y) { return !isNaN(y); });
    root();
    function root() {
      document.documentElement.style.setProperty('--bg', '#111110'); document.documentElement.style.setProperty('--fg', '#E9E8E4');
      document.documentElement.style.setProperty('--muted', '#9C9991'); document.documentElement.style.setProperty('--line', '#3A3936');
    }
    function draw() {
      var n = st.now, vertical = n.format === '4:5';
      var list = F.filter(function (f) { return st.k === 'all' || f.kind === st.k; });
      var player = st.playing
        ? '<iframe src="https://player.vimeo.com/video/' + n.vimeo + '?autoplay=1&title=0&byline=0&portrait=0&color=E9E8E4&dnt=1" allow="autoplay; fullscreen; picture-in-picture" title="' + esc(n.title) + '"></iframe>'
        : '<img src="' + n.thumb + '" alt=""><button type="button" class="playbtn" id="play" aria-label="Play ' + esc(n.title) + '"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#111110" stroke-width="2" stroke-linejoin="round"><path d="M7 4l13 8-13 8z"></path></svg></button>';
      document.getElementById('app').innerHTML = header('film', site) +
        '<section class="wrap" style="padding-block:72px 48px;display:flex;justify-content:space-between;align-items:flex-end;gap:32px;flex-wrap:wrap"><h1 style="margin:0;font-family:\'Big Shoulders Display\',sans-serif;font-weight:800;font-size:clamp(72px,12vw,200px);line-height:.82;text-transform:uppercase">Moving<br>image</h1></section>' +
        '<section class="wrap"><div class="stage-grid"><div class="player" style="' + (vertical ? 'aspect-ratio:4 / 5;height:min(78vh,760px);margin:0 auto;max-width:100%' : 'aspect-ratio:16 / 9;width:100%') + '">' + player + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:14px;padding-bottom:6px"><span style="font-family:\'Big Shoulders Display\',sans-serif;font-weight:300;font-size:clamp(36px,3.4vw,54px);line-height:.95;text-transform:uppercase">' + esc(n.title) + '</span><span class="serif it" style="font-size:22px">' + esc(n.client) + '</span><span class="muted" style="line-height:1.7">' + esc(n.note) + '</span><a class="pill" href="https://vimeo.com/' + n.vimeo + '" target="_blank" rel="noopener">Watch on Vimeo ↗</a></div></div></section>' +
        '<section class="wrap" style="padding-block:72px 40px"><div style="border-top:1px solid var(--line);padding-top:14px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap"><span></span><span>' +
        ['all', 'commission', 'research'].map(function (k) { return '<button type="button" class="tog" data-k="' + k + '" aria-pressed="' + (st.k === k) + '">' + (k === 'all' ? 'All' : k === 'commission' ? 'Commissions' : 'Research') + '</button>'; }).join('') + '</span></div></section>' +
        '<section class="wrap" style="padding-bottom:120px"><div class="films">' + list.map(function (f) {
          var on = f === n;
          return '<button type="button" class="film" data-id="' + f.vimeo + '"><span class="th" style="outline:' + (on ? '1px solid #E9E8E4' : 'none') + ';outline-offset:4px"><img loading="lazy" src="' + f.thumb + '" alt="">' + (on ? '<span class="badge" style="left:8px">●</span>' : '') + '</span>' +
            '<span style="display:flex;justify-content:space-between;gap:12px;align-items:baseline"><span style="font-family:\'Big Shoulders Display\',sans-serif;font-weight:300;font-size:24px;text-transform:uppercase;line-height:1">' + esc(f.title) + '</span><span class="serif it" style="font-size:15px">' + esc(f.client) + '</span></span></button>';
        }).join('') + '</div></section>' + footer(site);
      var pb = document.getElementById('play'); if (pb) pb.onclick = function () { st.playing = true; draw(); };
      $$('.film').forEach(function (b) { b.onclick = function () { st.now = F.filter(function (f) { return f.vimeo === b.dataset.id; })[0]; st.playing = true; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); }; });
      $$('.tog[data-k]').forEach(function (b) { b.onclick = function () { st.k = b.dataset.k; draw(); }; });
    }
    loadFont('Big+Shoulders+Display:wght@300;800');
    draw();
  }

  // ---------- ABOUT ----------
  function renderAbout(site) {
    var a = site.about, c = site.contact;
    loadFont('Cormorant+Garamond:ital,wght@1,300');
    function list(xs) { return '<ul>' + xs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
    document.getElementById('app').innerHTML = header('about', site) +
      '<section class="wrap" style="padding-block:96px 120px"><div class="about-intro"><div style="display:flex;flex-direction:column;gap:40px"><h1 style="margin:0;font-family:\'Cormorant Garamond\',serif;font-style:italic;font-weight:300;font-size:clamp(72px,10vw,168px);line-height:.85;letter-spacing:-.03em">About</h1>' +
      (a.portrait ? '<img src="' + a.portrait + '" alt="Mathieu Missiaen" style="width:100%;aspect-ratio:4 / 5;object-fit:cover">' : '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:28px;padding-top:12px"><p class="serif" style="margin:0;font-size:clamp(28px,2.6vw,40px);line-height:1.15">' + esc(a.short) + '</p>' +
      a.bio.map(function (b) { return '<p style="margin:0;font-size:13px;line-height:1.8;max-width:640px;opacity:.85">' + esc(b) + '</p>'; }).join('') + '</div></div></section>' +
      (a.wide && a.wide.src ? '<section style="padding-bottom:120px"><a href="' + esc(a.wide.href || '#') + '" target="_blank" rel="noopener" style="display:block"><img src="' + esc(a.wide.src) + '" alt="' + esc(a.wide.alt || '') + '" style="display:block;width:100%;height:auto;aspect-ratio:' + esc(a.wide.ratio || '16 / 9') + ';object-fit:cover"></a></section>' : '') +
      '<section class="wrap" style="padding-bottom:120px"><div class="facts rule" style="padding-top:24px">' +
      '<div style="display:flex;flex-direction:column;gap:14px"><span class="muted">Path</span>' + list(a.path) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px"><span class="muted">Selected clients</span>' + list(a.clients) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px"><span class="muted">Press &amp; editorials</span>' + list(a.press) + '<span class="muted" style="margin-top:24px">Tools</span>' + list(a.tools) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:12px"><span class="muted">Contact</span><span class="mail">' + esc(c.email) + '</span>' + (c.asia ? '<span class="muted" style="margin-top:12px">Asia</span><span class="mail">' + esc(c.asia) + '</span>' : '') +
      '<span class="muted" style="margin-top:12px">Elsewhere</span><a href="' + esc(c.instagram) + '" target="_blank" rel="noopener">Instagram ↗</a>' + (c.vimeo ? '<a href="' + esc(c.vimeo) + '" target="_blank" rel="noopener">Vimeo ↗</a>' : '') + (c.iolo ? '<a href="' + esc(c.iolo) + '" target="_blank" rel="noopener">iolo.paris — objects, art direction ↗</a>' : '') + '<span style="margin-top:12px;line-height:1.6">Paris — working worldwide.<br>English, French.</span></div></div></section>' +
      footer(site);
  }

  // ---------- boot ----------
  var page = document.body.getAttribute('data-page');
  var need = { home: ['site', 'projects', 'films'], project: ['site', 'projects'], gallery: ['site', 'projects'], film: ['site', 'films', 'projects'], about: ['site', 'projects'] }[page] || ['site', 'projects'];
  Promise.all(need.map(getJSON)).then(function (r) {
    var site = r[0], data = r[1];
    var projs = (r[need.indexOf('projects')] || {}).projects || [];
    window.__TABS = projs.filter(function (p) { return p.tab; });
    if (page === 'home') data = { projects: r[1].projects, films: r[2] };
    if (page === 'home') renderHome(site, data);
    else if (page === 'project') { renderProject(site, data); window.addEventListener('hashchange', function () { renderProject(site, data); }); }
    else if (page === 'gallery') renderGallery(site, data);
    else if (page === 'film') renderFilm(site, data);
    else if (page === 'about') renderAbout(site);
  }).catch(function (e) {
    document.getElementById('app').innerHTML = '<p class="wrap" style="padding-block:80px">The content could not be loaded (' + esc(e.message) + ').</p>';
  });
})();
