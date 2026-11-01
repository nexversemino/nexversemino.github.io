"""Loopback-only static preview with GitHub Pages directory/redirect semantics.
?capture=1 is a local QA-only frozen animation state, never part of deployment.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import subprocess, os, re, socket
ROOT=Path(__file__).resolve().parents[1]
CAPTURE='''<style>*,*::before,*::after{animation:none!important;transition:none!important} .nex-dragon-video{visibility:hidden!important} html body .nex-dragon-video-layer{background:center/contain no-repeat url('/assets/dragon-loop-poster.jpg')!important} #site-interactions,#hopik-mascot,#morfiai-arkanoid,.morfiai-living-word,.morfiai-battle-ui,[id^="morfiai-cursor"]{visibility:hidden!important} .opacity-0{opacity:1!important}.translate-y-8{transform:none!important}.invisible{visibility:visible!important}.blink{display:none!important}</style><script>const actualMatch=window.matchMedia.bind(window);window.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:actualMatch(q);HTMLMediaElement.prototype.play=function(){return Promise.resolve()};</script>'''
BASELINE=subprocess.check_output(['git','show','9dd6b7d4:index.html'],cwd=ROOT).decode('utf-8')
# Static capture must not navigate the historical TanStack app to the QA-only path.
BASELINE=re.sub(r'<script type="module" async="" src="assets/index-[^"]+"></script>','',BASELINE)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
    def do_GET(self):
        u=urlsplit(self.path);path=u.path
        if path=='/_original-hero-copy.js':
            data=subprocess.check_output(['git','show','9dd6b7d4:assets/hero-copy.js'],cwd=ROOT)
            self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
        if path=='/_baseline/':
            s=BASELINE.replace('<head>','<head><base href="/"/>').replace('assets/hero-copy.js?v=6','/_original-hero-copy.js')
        elif parse_qs(u.query).get('capture')==['1']:
            p=(ROOT/path.lstrip('/')).resolve()
            if not p.is_relative_to(ROOT):self.send_error(404);return
            if p.is_dir():p/='index.html'
            if not p.is_file() or p.suffix!='.html':return super().do_GET()
            s=p.read_text('utf-8')
        else:return super().do_GET()
        if parse_qs(u.query).get('capture')==['1']:s=s.replace('<head>','<head>'+CAPTURE,1)
        data=s.encode('utf-8');self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
class PreviewServer(ThreadingHTTPServer):
    allow_reuse_address=False
    def server_bind(self):
        if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
        super().server_bind()
if __name__=='__main__':
    print('MORFIAI preview: http://127.0.0.1:4182 (local only)',flush=True)
    PreviewServer(('127.0.0.1',4182),Handler).serve_forever()
