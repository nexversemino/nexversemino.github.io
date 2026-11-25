"""Render the existing published MORFIAI components into real GitHub Pages paths.

No SPA fallback, new framework, copied site, or invented visual components.
Templates are extracted verbatim from deployed commit 9dd6b7d4 (see docs/OVERENI.md).
"""
from pathlib import Path
from html import escape
import json, re

ROOT=Path(__file__).resolve().parents[1]
def template(name, **values):
    value=(ROOT/'templates'/f'{name}.html').read_text('utf-8')
    for key,text in values.items(): value=value.replace('{{'+key+'}}',str(text))
    return value

def cards(items):
    result=[]
    for i,item in enumerate(items):
        title,text,*link=item
        card=template('card',title=escape(title,quote=True),text=escape(text),code=f'{i+1:02}',color=['cyan','pink','lime','orange'][i%4],delay=(i%3)*120)
        if link:
            # Entire original card is the link; its original wrappers and styling stay shared.
            card='<a class="site-card-link" href="'+escape(link[0],quote=True)+'">'+card+'</a>'
        result.append(card)
    return ''.join(result)

LINK=re.compile(r'\[([^\]]+)\]\((https://[^)\s]+)\)')
def inline(text):
    # Article text supports [label](https://url) links; everything else stays escaped plain text.
    result=[];pos=0
    for match in LINK.finditer(text):
        result.append(escape(text[pos:match.start()]))
        result.append('<a href="'+escape(match.group(2),quote=True)+'" target="_blank" rel="noopener">'+escape(match.group(1))+'</a>')
        pos=match.end()
    result.append(escape(text[pos:]))
    return ''.join(result)

# Short captions for the animated story scenes (see assets/article-scenes.js).
SCENE_LABELS={
    'firma':'Firma, která se psala sama',
    'doom':'Nohy nahoru, káva a DOOM',
    'napad':'Nápady se množí',
    'dcera':'Dcera má taky nápad',
    'armada':'Armáda hotových assetů',
    'slozite':'Složité na výstup, jednoduché na vstup',
}

def scene_figure(scene):
    label=escape(SCENE_LABELS.get(scene,scene))
    return ('<figure class="article-scene" data-scene="%s" tabindex="0" role="button" '
            'aria-label="Přehrát animaci: %s"><canvas aria-hidden="true"></canvas>'
            '<figcaption>%s</figcaption></figure>')%(escape(scene,quote=True),label,label)

REVEAL='transition-all duration-700 ease-out translate-y-8 opacity-0'
COLORS=['cyan','pink','lime','orange','violet']

def presentation(p):
    """Detailed product presentation (used by /engine/). Text from content.json is escaped;
    only the heading keeps the same inline <em> markup the other headings use."""
    def rv(inner,delay=0,extra=''):
        return '<div class="%s%s" style="transition-delay:%dms">%s</div>'%(REVEAL,extra,delay,inner)
    out=['<section id="prezentace" class="engine-pres relative z-10 mx-auto max-w-7xl px-6 py-28">']
    out.append(rv('<p class="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan">// %s</p>'
                  '<h2 class="mt-4 max-w-3xl font-display text-5xl font-light leading-[1.2] md:text-6xl"><span data-orb="bounce" data-orb-color="var(--neon-cyan)">%s</span></h2>'
                  '<p class="engine-pres-intro">%s</p>'%(escape(p['eyebrow']),p['heading'],escape(p['intro']))))
    steps=''.join('<li class="engine-step engine-c-%s"><span class="engine-step-num">%s</span><strong>%s</strong><span>%s</span></li>'
                  %(COLORS[i%len(COLORS)],escape(n),escape(t),escape(s)) for i,(n,t,s) in enumerate(p['pipeline']))
    out.append(rv('<ol class="engine-pipeline" aria-label="Postup od předlohy po export">'+steps+'</ol>',120))
    stats=''.join('<div class="engine-stat engine-c-%s"><span class="engine-stat-value">%s</span><span class="engine-stat-label">%s</span></div>'
                  %(COLORS[i%len(COLORS)],escape(v),escape(l)) for i,(v,l) in enumerate(p['stats']))
    out.append(rv('<div class="engine-stats">'+stats+'</div>',180))
    toc=''.join('<li><a href="/engine/#modul-%d"><span>%02d</span>%s</a></li>'%(i+1,i+1,escape(m['title'])) for i,m in enumerate(p['modules']))
    out.append(rv('<nav class="engine-toc" aria-label="Kapitoly prezentace"><p class="font-mono text-xs uppercase tracking-[0.3em] text-neon-pink">// obsah</p><ol>'+toc+'</ol></nav>'))
    for i,m in enumerate(p['modules']):
        color=COLORS[i%len(COLORS)]
        points=''.join('<li>'+escape(x)+'</li>' for x in m['points'])
        note='<p class="engine-note"><span>poctivě</span>'+escape(m['note'])+'</p>' if m.get('note') else ''
        text=('<span class="font-mono text-sm text-neon-%s">[%02d]</span>'
              '<h3 class="engine-mod-title text-neon-%s"><span data-typed-title="%s">%s</span></h3>'
              '<p class="engine-mod-lead">%s</p><ul class="engine-points">%s</ul>%s'
              %(color,i+1,color,escape(m['title'],quote=True),escape(m['title']),escape(m['lead']),points,note))
        media=''
        if m.get('image'):
            src,alt,caption,w,h=m['image']
            media=('<figure class="engine-shot"><img src="%s" alt="%s" loading="lazy" decoding="async" width="%d" height="%d"/>'
                   '<figcaption>%s</figcaption></figure>'%(escape(src,quote=True),escape(alt,quote=True),w,h,escape(caption)))
        cls='engine-mod engine-c-%s%s'%(color,' has-shot' if media else '')
        out.append('<article id="modul-%d" class="%s">%s</article>'%(i+1,cls,rv('<div class="engine-mod-text">'+text+'</div>'+media)))
    private=''.join('<li>'+escape(x)+'</li>' for x in p['private'])
    out.append(rv('<div class="engine-private"><p class="font-mono text-xs uppercase tracking-[0.3em] text-neon-lime">// soukromí a bezpečnost</p>'
                  '<h3 class="engine-mod-title">Vaše data zůstávají u vás</h3><ul class="engine-points">'+private+'</ul></div>'))
    out.append('</section>')
    return ''.join(out)

def live_preview(l):
    """Live world preview (used by /laya/): a muted loop from the real game that links to /svet/.
    No iframe: pages stay plain documents. assets/laya-live.js only swaps the status badge text
    (live now / sleeping) from the public state file; without JS the badge keeps its neutral text."""
    def rv(inner,delay=0):
        return '<div class="%s" style="transition-delay:%dms">%s</div>'%(REVEAL,delay,inner)
    link=escape(l['link'],quote=True)
    video,poster=escape(l['video'],quote=True),escape(l['poster'],quote=True)
    return ('<section id="zivy-svet" class="laya-live relative z-10 mx-auto max-w-7xl px-6 py-28">'
            +rv('<p class="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan">// %s</p>'
                '<h2 class="mt-4 max-w-3xl font-display text-5xl font-light leading-[1.2] md:text-6xl"><span data-orb="bounce" data-orb-color="var(--neon-cyan)">%s</span></h2>'
                '<p class="laya-live-intro">%s</p>'%(escape(l['eyebrow']),l['heading'],escape(l['text'])))
            +rv('<a class="laya-live-frame" href="%s" aria-label="%s">'
                '<video src="%s" poster="%s" autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>'
                '<span class="laya-live-badge" data-live-status="%s">%s</span>'
                '<span class="laya-live-caption">%s</span></a>'
                %(link,escape(l['button'],quote=True),video,poster,escape(l['status_url'],quote=True),escape(l['badge']),escape(l['caption'])),120)
            +rv('<div class="laya-live-actions"><a href="%s" class="block bg-neon-gradient px-10 py-5 font-mono text-sm font-bold uppercase tracking-widest text-primary-foreground">%s</a>'
                '<p class="laya-live-note">%s</p></div>'%(link,escape(l['button']),escape(l['note'])),180)
            +'</section>')

def downloads(d):
    """Downloadable 3D print sets (used by /3d-tisky/). Text is escaped; files are plain links
    to release assets – no forms, accounts or checkout."""
    def rv(inner,delay=0):
        return '<div class="%s" style="transition-delay:%dms">%s</div>'%(REVEAL,delay,inner)
    out=['<section id="ke-stazeni" class="dl relative z-10 mx-auto max-w-7xl px-6 py-28">']
    out.append(rv('<p class="font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan">// %s</p>'
                  '<h2 class="mt-4 max-w-3xl font-display text-5xl font-light leading-[1.2] md:text-6xl"><span data-orb="bounce" data-orb-color="var(--neon-cyan)">%s</span></h2>'
                  '<p class="dl-intro">%s</p>'%(escape(d['eyebrow']),d['heading'],escape(d['intro']))))
    for i,item in enumerate(d['items']):
        color=COLORS[i%len(COLORS)]
        specs=''.join('<li>'+escape(s)+'</li>' for s in item['specs'])
        note='<p class="dl-note"><span>poctivě</span>'+escape(item['note'])+'</p>' if item.get('note') else ''
        out.append(('<article id="%s" class="dl-item dl-c-%s">'%(escape(item['id'],quote=True),color))
                   +rv('<figure class="dl-shot"><img src="%s" alt="%s" loading="lazy" decoding="async" width="960" height="720"/></figure>'
                       '<div class="dl-text"><span class="font-mono text-sm text-neon-%s">[%02d]</span>'
                       '<h3 class="dl-title">%s</h3><p class="dl-lead">%s</p><ul class="dl-specs">%s</ul>%s'
                       '<a class="dl-button" href="%s" download>%s <span>%s</span></a></div>'
                       %(escape(item['image'],quote=True),escape(item['alt'],quote=True),color,i+1,escape(item['title']),
                         escape(item['text']),specs,note,escape(item['file'],quote=True),escape(item['button']),escape(item['size'])))
                   +'</article>')
    out.append(rv('<p class="dl-license">%s</p>'%escape(d['license'])))
    out.append('</section>')
    return ''.join(out)

def render(slug,page):
    title=page['title']+' — MORFIAI' if slug else 'MORFIAI — každý nápad je začátek nového světa'
    head=template('head')
    if slug:
        # The GLB character preview belongs to the homepage only.
        for tag in ('<link rel="stylesheet" href="assets/dragon-viewer.css?v=6"/>',
                    '<link rel="stylesheet" href="assets/laya-controls.css?v=6"/>',
                    '<script type="module" src="assets/dragon-viewer.js?v=32"></script>',
                    '<link rel="stylesheet" href="assets/dragon-loading.css?v=1"/>'):
            assert tag in head, tag
            head=head.replace(tag,'')
    head=re.sub(r'<title>.*?</title>','<title>'+escape(title)+'</title>',head)
    for attr,key,value in [('name','description',page['description']),('property','og:title',title),('property','og:description',page['description']),('name','twitter:title',title),('name','twitter:description',page['description'])]:
        head=re.sub(r'(<meta\s+'+attr+'="'+re.escape(key)+r'"\s+content=")[^"]*',lambda m:m[1]+escape(value,quote=True),head)
    canonical='https://morfiai.eu/'+(slug+'/' if slug else '')
    head=head.replace('</head>','<link rel="canonical" href="'+canonical+'"/></head>')
    hero=template('hero')
    hero=hero.replace('<section ',f'<section data-title-line1="{escape(page["lines"][0],quote=True)}" data-title-line2="{escape(page["lines"][1],quote=True)}" ',1)
    hero=hero.replace('system.init(nexverse)','system.init('+('morfiai' if not slug else slug)+')')
    hero=re.sub(r'<p class="mt-8 max-w-md text-lg text-muted-foreground">.*?</p>','<p class="mt-8 max-w-md text-lg text-muted-foreground">'+escape(page['description'])+'</p>',hero,flags=re.S)
    hero=hero.replace('href="#kontakt"', 'href="#funkce"').replace('Začít tvořit',page['cta'])
    hero=hero.replace('href="#engine"','href="/engine/"' if not slug else 'href="/'+slug+'/#kontakt"').replace('Ukázka enginu','Asset Engine' if not slug else 'Kontakt')
    hero=hero.replace('href="#funkce"','href="/'+(slug+'/' if slug else '')+'#funkce"')
    for old,new in zip(['12×','rychlejší produkce','40k+','vygenerovaných assetů','60 fps','realtime náhled'],page['stats']):hero=hero.replace(old,escape(new))
    # Sample mesh caption is a real visual demo, not a product benchmark.
    hero=hero.replace('MESH: dragon_v3.fbx','UKÁZKA: neonový drak').replace('polys 48 210 · rig ✓ · anim 24','animovaná ukázka · 3D náhled')
    features=template('features',eyebrow=page['eyebrow'],heading=page['heading'],cards=cards(page['cards']))
    split=template('split',eyebrow=page['split'][0],heading=page['split'][1],text=escape(page['split'][2]),workflow=escape('\n'.join(page['workflow'])))
    live=''
    if page.get('live'):
        head=head.replace('</head>','<link rel="stylesheet" href="assets/laya-live.css?v=1"/><script type="module" src="assets/laya-live.js?v=1"></script></head>')
        live=live_preview(page['live'])
    dl=''
    if page.get('downloads'):
        head=head.replace('</head>','<link rel="stylesheet" href="assets/downloads.css?v=1"/></head>')
        dl=downloads(page['downloads'])
    pres=''
    if page.get('presentation'):
        head=head.replace('</head>','<link rel="stylesheet" href="assets/engine-presentation.css?v=1"/></head>')
        pres=presentation(page['presentation'])
    article=''
    if page.get('article'):
        head=head.replace('</head>','<link rel="stylesheet" href="assets/article-story.css?v=2"/><script type="module" src="assets/article-story.js?v=1"></script><script type="module" src="assets/article-scenes.js?v=1"></script></head>')
        parts=[]
        section=0
        for i,item in enumerate(page['article']):
            tag,text,*extra=item
            scene=extra[0] if extra else None
            scene_attr=' data-scene="%s"'%scene if scene else ''
            delay=(i%4)*70
            reveal='transition-all duration-700 ease-out translate-y-8 opacity-0' if tag in ('h2','h3') else 'transition-all duration-700 ease-out opacity-0'
            style=' style="transition-delay:%dms"'%delay
            if tag=='h2':
                section+=1
                heading='<span class="article-num" aria-hidden="true">// %02d</span>'%section+escape(text)
                parts.append('<h2 id="pribeh-%d" data-chapter="%s" data-orb="bounce" data-orb-color="var(--neon-cyan)" class="%s"%s%s>%s</h2>'%(section,escape(text,quote=True),reveal,style,scene_attr,heading))
            elif tag=='h3':
                parts.append('<h3 class="%s"%s%s>%s</h3>'%(reveal,style,scene_attr,escape(text)))
            else:
                # The closing signature types itself out through the shared typed-title effect.
                typed=' data-typed-title="%s"'%escape(text,quote=True) if text.startswith('MORFIAI –') else ''
                parts.append('<p class="text-lg text-foreground/85 %s"%s%s%s>%s</p>'%(reveal,typed,style,scene_attr,inline(text)))
            if scene:
                parts.append(scene_figure(scene))
        intro=('<p class="article-eyebrow transition-all duration-700 ease-out opacity-0" style="transition-delay:0ms">// příběh morfiai</p>'
               '<h2 class="article-title transition-all duration-700 ease-out translate-y-8 opacity-0" data-orb="drop" data-orb-color="var(--neon-pink)" style="transition-delay:70ms">Každý nápad je začátek nového světa…</h2>'
               '<div class="article-rule transition-all duration-700 ease-out opacity-0" style="transition-delay:140ms" aria-hidden="true"></div>')
        article='<section id="pribeh" class="site-article relative z-10 mx-auto max-w-3xl px-6 py-28">'+intro+''.join(parts)+'</section>'
    contact=template('contact',heading=page.get('contact_heading','Máte nápad? <em class="text-neon-gradient">Ozvěte se.</em>'),text=escape(page.get('contact_text','Zajímá vás některý z projektů nebo spolupráce? Napište nám.')))
    out=head+'<body><div class="min-h-screen bg-background"><div id="site-interactions"></div>'+template('header')+hero+'<div class="h-px bg-neon-gradient"></div>'+features+dl+live+pres+split+article+contact+template('foot')
    # Content must remain available if JS is disabled. Reveal animation is progressive.
    out=out.replace('</head>','<noscript><style>.opacity-0{opacity:1!important}.translate-y-8{transform:none!important}</style></noscript></head>')
    path=ROOT/slug/'index.html' if slug else ROOT/'index.html'
    path.parent.mkdir(exist_ok=True)
    path.write_text(out,'utf-8')
    assert '{{' not in out, f'Unresolved template token: {slug}'

if __name__=='__main__':
    pages=json.loads((ROOT/'src/content.json').read_text('utf-8'))
    for slug,page in pages.items():render(slug,page)
    print('Built '+', '.join('/'+slug for slug in pages)+' using shared deployed components.')
