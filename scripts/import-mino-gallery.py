"""Import owner-authored Mino originals without modifying source archives.
Transfer only animation buffers to identical named joint hierarchies/rest transforms.
"""
import pathlib,json,struct,zipfile,copy,hashlib,runpy
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path('G:/Můj disk/disk C msi/Archivy/Downloads')
def read(b):
 n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);return d,b[28+n:]
def write(d,b):
 d['buffers'][0]['byteLength']=len(b);j=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4);b+=b'\0'*((-len(b))%4)
 return struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b
def transfer(target,donor):
 t,tb=read(target);s,sb=read(donor);original=copy.deepcopy(t);names={n.get('name'):i for i,n in enumerate(t['nodes'])};acc={};views={}
 parents=lambda d:{c:i for i,n in enumerate(d['nodes']) for c in n.get('children',[])}
 sp,tp=parents(s),parents(t)
 def accessor(i):
  nonlocal tb
  if i in acc:return acc[i]
  a=copy.deepcopy(s['accessors'][i]);assert 'sparse' not in a
  v=a['bufferView']
  if v not in views:
   bv=copy.deepcopy(s['bufferViews'][v]);assert bv.get('buffer',0)==0
   off=bv.get('byteOffset',0);data=sb[off:off+bv['byteLength']];tb+=b'\0'*((-len(tb))%4);bv['byteOffset']=len(tb);tb+=data;views[v]=len(t['bufferViews']);t['bufferViews'].append(bv)
  a['bufferView']=views[v];acc[i]=len(t['accessors']);t['accessors'].append(a);return acc[i]
 existing={a.get('name') for a in t['animations']}
 for anim in s['animations']:
  if anim['name'] in existing:continue
  a=copy.deepcopy(anim)
  for c in a['channels']:
   si=c['target']['node'];name=s['nodes'][si]['name'];ti=names[name]
   assert sum(n.get('name')==name for n in t['nodes'])==1
   for k in ['translation','rotation','scale','matrix']:assert s['nodes'][si].get(k)==t['nodes'][ti].get(k),(name,k)
   # Root name differs; all animated joint parents must match by name.
   if si in sp and sp[si]!=0:assert s['nodes'][sp[si]].get('name')==t['nodes'][tp[ti]].get('name')
   c['target']['node']=ti
  for sampler in a['samplers']:
   sampler['input']=accessor(sampler['input']);sampler['output']=accessor(sampler['output'])
  t['animations'].append(a)
 for key in ['nodes','meshes','skins','materials','images','textures']:assert t.get(key)==original.get(key),key
 assert tb[:len(read(target)[1])]==read(target)[1]
 return write(t,tb)
def main():
 catalog=json.loads((ROOT/'assets/character-catalog.json').read_text());catalog=[c for c in catalog if not c['id'].startswith(('mino-','classic-'))];report=[]
 def add(id,label,b,source):
  d,_=read(b);p=ROOT/'assets'/f'{id}.glb';p.write_bytes(b);clips=[a['name'] for a in d.get('animations',[])];assert len(clips)>=109
  catalog.append(dict(id=id,label=label,src='/assets/'+p.name,clips=clips,sha256=hashlib.sha256(b).hexdigest()))
  report.append(dict(id=id,source=source,clips=len(clips),bytes=len(b),morphs=sorted({n for m in d['meshes'] for n in m.get('extras',{}).get('targetNames',[])})))
 with zipfile.ZipFile(SOURCE/'Mino_vsech_8_opravene_spoje.zip') as z:
  donor=z.read('Copper-109-animaci-connected.glb')
  for n in z.namelist():
   if n.endswith('.glb'):
    label=n.split('-')[0];add('classic-'+label.lower(),label+' – 109 animací',z.read(n),str(SOURCE/z.filename)+' :: '+n)
 repair=runpy.run_path(str(ROOT/'scripts/repair-mino-faces.py'))['repair']
 with zipfile.ZipFile(SOURCE/'Mino-5-barevnych-postav-GLB.zip') as z:
  for n in z.namelist():
   if n.endswith('.glb'):
    label=n.removesuffix('.glb').removeprefix('Mino-');add('mino-'+label.lower(),'Míno '+label,repair(z.read(n))[0],z.filename+' :: '+n)
 for p in sorted(pathlib.Path('G:/Můj disk/Pro nex').glob('Mino-*-4-animace.glb')):
  number=p.name.split('-')[1];add('mino-'+number,'Míno '+number,transfer(p.read_bytes(),donor),str(p))
 (ROOT/'assets/character-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8')
 labels=json.loads((ROOT/'assets/animation-labels-cs.json').read_text())
 cs={'Breathe':'Dýchání','Walk':'Chůze','Run':'Běh','T_Pose':'T-póza','blink':'Mrkání','talk':'Mluva','happy':'Radost','angry':'Hněv','sad':'Smutek','surprise':'Překvapení'}
 for c in catalog:
  for n in c['clips']:
   if n not in labels:labels[n]=cs.get(n,n.replace('_',' '))
 (ROOT/'assets/animation-labels-cs.json').write_text(json.dumps(labels,ensure_ascii=False),encoding='utf8')
 (ROOT/'assets/character-data.js').write_text('export const characters='+json.dumps(catalog,ensure_ascii=False)+';\nexport const labels='+json.dumps(labels,ensure_ascii=False)+';\n',encoding='utf8')
 (ROOT/'docs/laya-qa/mino-import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 print(json.dumps(report,ensure_ascii=False,indent=2));print('CATALOG',len(catalog))
if __name__=='__main__':main()
