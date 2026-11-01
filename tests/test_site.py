from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import unittest, subprocess, hashlib, json, re
ROOT=Path(__file__).resolve().parents[1]
PAGES=['','engine','command-center','milo','laya','blog']
class Doc(HTMLParser):
    def __init__(self,text):super().__init__();self.tags=[];self.feed(text)
    def handle_starttag(self,tag,attrs):self.tags.append((tag,dict(attrs)))
class SiteTests(unittest.TestCase):
    def test_all_directories_are_real_pages(self):
        for slug in PAGES:
            p=ROOT/slug/'index.html';self.assertTrue(p.is_file());s=p.read_text('utf-8');self.assertNotIn('{{',s);self.assertNotIn('\x00',s)
            d=Doc(s);self.assertEqual(sum(t=='h1' for t,a in d.tags),1)
            self.assertTrue(any(t=='base' and a['href']=='/' for t,a in d.tags))
    def test_all_local_links_and_assets_resolve(self):
        for slug in PAGES:
            s=(ROOT/slug/'index.html').read_text('utf-8');d=Doc(s)
            for tag,a in d.tags:
                for attr in ['href','src']:
                    url=a.get(attr,'');u=urlsplit(url)
                    if not url or u.scheme or url.startswith('//'):continue
                    p=ROOT/u.path.lstrip('/') if u.path else ROOT/slug/'index.html'
                    if p.is_dir():p/='index.html'
                    self.assertTrue(p.is_file(),f'{slug}: {url}')
                    if u.fragment:self.assertRegex(p.read_text('utf-8'),r'id="'+re.escape(u.fragment)+'"')
    def test_original_design_and_binary_assets_unchanged(self):
        names=subprocess.check_output(['git','ls-tree','-r','--name-only','9dd6b7d4'],cwd=ROOT,text=True).splitlines()
        for name in names:
            if name.endswith(('.css','.png','.jpg','.mp4','.glb','.svg')) or name=='CNAME':
                before=subprocess.check_output(['git','show','9dd6b7d4:'+name],cwd=ROOT)
                after=(ROOT/name).read_bytes()
                if name.endswith(('.css','.svg')) or name=='CNAME':
                    before=before.replace(b'\r\n',b'\n');after=after.replace(b'\r\n',b'\n')
                self.assertEqual(hashlib.sha256(before).hexdigest(),hashlib.sha256(after).hexdigest(),name)
    def test_one_shared_design_and_navigation(self):
        nav=[]
        for slug in PAGES:
            s=(ROOT/slug/'index.html').read_text('utf-8');nav.append(re.search(r'<header.*?</header>',s,re.S)[0])
            for asset in ['styles-Dsiogmp1.css','hero-video.css','mobile-fix.css','morfiai-arkanoid.js','site-client.js']:self.assertIn(asset,s)
        self.assertEqual(len(set(nav)),1)
    def test_no_fake_product_actions_or_accounts(self):
        for slug in PAGES:
            d=Doc((ROOT/slug/'index.html').read_text('utf-8'))
            self.assertFalse(any(t in ['form','input','iframe'] for t,a in d.tags))
        data=json.loads((ROOT/'src/content.json').read_text('utf-8'))
        self.assertIn('není herní engine',data['engine']['split'][2])
        self.assertIn('budoucí',json.dumps(data['laya'],ensure_ascii=False).lower())
    def test_reproducible_build(self):
        before=[(ROOT/p/'index.html').read_bytes() for p in PAGES]
        subprocess.run(['python','-X','utf8','scripts/build.py'],cwd=ROOT,check=True,capture_output=True)
        self.assertEqual(before,[(ROOT/p/'index.html').read_bytes() for p in PAGES])
    def test_story_does_not_expose_the_platform(self):
        self.assertIn('MinoBuddy',(ROOT/'blog/index.html').read_text('utf-8'))
        self.assertIn('Platforma zatím není veřejně dostupná',(ROOT/'blog/index.html').read_text('utf-8'))
        for slug in PAGES:
            for tag,a in Doc((ROOT/slug/'index.html').read_text('utf-8')).tags:
                self.assertNotIn('minobuddy',a.get('href','').lower())
        self.assertFalse((ROOT/'minobuddy').exists())
    def test_real_arkanoid_handoff_module(self):
        result=subprocess.run(['node','tests/arkanoid-handoff.test.cjs'],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)
    def test_dragon_loader_does_not_cancel_slow_download(self):
        result=subprocess.run(['node','tests/dragon-loader.test.cjs'],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)
if __name__=='__main__':unittest.main()
