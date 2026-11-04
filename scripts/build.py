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
    article=''
    if page.get('article'):
        head=head.replace('</head>','<link rel="stylesheet" href="assets/article-story.css?v=1"/><script type="module" src="assets/article-story.js?v=1"></script></head>')
        parts=[]
        section=0
        for i,(tag,text) in enumerate(page['article']):
            delay=(i%4)*70
            reveal='transition-all duration-700 ease-out translate-y-8 opacity-0' if tag in ('h2','h3') else 'transition-all duration-700 ease-out opacity-0'
            style=' style="transition-delay:%dms"'%delay
            if tag=='h2':
                section+=1
                heading='<span class="article-num" aria-hidden="true">// %02d</span>'%section+escape(text)
                parts.append('<h2 id="pribeh-%d" data-chapter="%s" data-orb="bounce" data-orb-color="var(--neon-cyan)" class="%s"%s>%s</h2>'%(section,escape(text,quote=True),reveal,style,heading))
            elif tag=='h3':
                parts.append('<h3 class="%s"%s>%s</h3>'%(reveal,style,escape(text)))
            else:
                # The closing signature types itself out through the shared typed-title effect.
                typed=' data-typed-title="%s"'%escape(text,quote=True) if text.startswith('MORFIAI –') else ''
                parts.append('<p class="text-lg text-foreground/85 %s"%s%s>%s</p>'%(reveal,typed,style,inline(text)))
        intro=('<p class="article-eyebrow transition-all duration-700 ease-out opacity-0" style="transition-delay:0ms">// příběh morfiai</p>'
               '<h2 class="article-title transition-all duration-700 ease-out translate-y-8 opacity-0" data-orb="drop" data-orb-color="var(--neon-pink)" style="transition-delay:70ms">Každý nápad je začátek nového světa…</h2>'
               '<div class="article-rule transition-all duration-700 ease-out opacity-0" style="transition-delay:140ms" aria-hidden="true"></div>')
        article='<section id="pribeh" class="site-article relative z-10 mx-auto max-w-3xl px-6 py-28">'+intro+''.join(parts)+'</section>'
    contact=template('contact',heading=page.get('contact_heading','Máte nápad? <em class="text-neon-gradient">Ozvěte se.</em>'),text=escape(page.get('contact_text','Zajímá vás některý z projektů nebo spolupráce? Napište nám.')))
    out=head+'<body><div class="min-h-screen bg-background"><div id="site-interactions"></div>'+template('header')+hero+'<div class="h-px bg-neon-gradient"></div>'+features+split+article+contact+template('foot')
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
