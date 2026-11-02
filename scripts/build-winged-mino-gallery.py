"""Rebuild winged owner Mino copies. Inputs are never changed.
python scripts/build-winged-mino-gallery.py --source-dir <original copies> --output-dir <staging> [--install]
"""
import argparse,pathlib,runpy,json,hashlib,shutil,struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source-dir',type=pathlib.Path,required=True);ap.add_argument('--output-dir',type=pathlib.Path,required=True);ap.add_argument('--install',action='store_true');a=ap.parse_args();assert a.source_dir.resolve()!=a.output_dir.resolve();a.output_dir.mkdir(parents=True,exist_ok=True)
 face=runpy.run_path(str(ROOT/'scripts/upgrade-winged-mino-faces.py'))['upgrade'];wing=runpy.run_path(str(ROOT/'scripts/upgrade-mino-wings.py'))['upgrade'];reports=[]
 for i in range(1,16):
  name=f'mino-{i:02}.glb';source=a.source_dir/name;original=source.read_bytes();b,fr=face(original);b,wr=wing(b);(a.output_dir/name).write_bytes(b);reports.append(dict(id=f'mino-{i:02}',sourceSha256=hashlib.sha256(original).hexdigest(),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),face=fr,wings=wr));print(name,flush=True)
 (a.output_dir/'upgrade-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf8')
 if not a.install:return
 catalog=json.loads((ROOT/'assets/character-catalog.json').read_text());labels=json.loads((ROOT/'assets/animation-labels-cs.json').read_text());by={r['id']:r for r in reports}
 for c in catalog:
  if c['id'] not in by:continue
  name=c['id']+'.glb';b=(a.output_dir/name).read_bytes();d=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]]);shutil.copy2(a.output_dir/name,ROOT/'assets'/name);c.update(src='/assets/'+name+'?winged=2',clips=[v['name'] for v in d['animations']],sha256=by[c['id']]['sha256'],angerEyes=['Mino_NEX_Eye_L','Mino_NEX_Eye_R'])
  for clip in d['animations']:labels.setdefault(clip['name'],clip.get('extras',{}).get('label_cs',clip['name']))
 (ROOT/'assets/character-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8');(ROOT/'assets/animation-labels-cs.json').write_text(json.dumps(labels,ensure_ascii=False),encoding='utf8');(ROOT/'assets/character-data.js').write_text('export const characters='+json.dumps(catalog,ensure_ascii=False)+';\nexport const labels='+json.dumps(labels,ensure_ascii=False)+';\n',encoding='utf8')
if __name__=='__main__':main()
