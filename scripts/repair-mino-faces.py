"""Repair owner source facial morphs in web copies, using local feature pivots.
Original archives stay unchanged. Shapes are glTF position DELTAS, never absolute coordinates.
"""
import pathlib,json,struct,math,hashlib
import runpy
_helpers=runpy.run_path(str(pathlib.Path(__file__).with_name('import-mino-gallery.py')))
read,write=_helpers['read'],_helpers['write']
ROOT=pathlib.Path(__file__).resolve().parents[1]
def repair(blob):
 d,bb=read(blob);bb=bytearray(bb);report=[]
 def floats(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];assert a['componentType']==5126 and a['type']=='VEC3';off=v.get('byteOffset',0)+a.get('byteOffset',0);return list(struct.unpack_from('<'+'f'*a['count']*3,bb,off))
 def append(values):
  nonlocal bb
  bb.extend(b'\0'*((-len(bb))%4));off=len(bb);bb.extend(struct.pack('<'+'f'*len(values),*values));vi=len(d['bufferViews']);d['bufferViews'].append(dict(buffer=0,byteOffset=off,byteLength=len(values)*4));ai=len(d['accessors']);d['accessors'].append(dict(bufferView=vi,componentType=5126,count=len(values)//3,type='VEC3',min=[min(values[k::3]) for k in range(3)],max=[max(values[k::3]) for k in range(3)]));return ai
 names={n['mesh']:n.get('name','') for n in d['nodes'] if 'mesh' in n}
 for mi,m in enumerate(d['meshes']):
  targets=m.get('extras',{}).get('targetNames',[])
  if not targets:continue
  name=names.get(mi,'');is_brow='Brow' in name;is_mouth=any(x in name for x in ['Mouth','Smile','Jaw']);is_eye=not is_brow and not is_mouth
  for p in m['primitives']:
   base=floats(p['attributes']['POSITION']);cx,cy,cz=[(min(base[k::3])+max(base[k::3]))/2 for k in range(3)];width=max(base[::3])-min(base[::3]);height=max(base[1::3])-min(base[1::3])
   for ti,kind in enumerate(targets):
    delta=[]
    for j in range(0,len(base),3):
     x,y,z=base[j:j+3];dx=dy=dz=0
     if is_eye:
      sy={'blink':.06,'happy':.65,'angry':.74,'sad':.85,'surprise':1.12}.get(kind,1);dy=(y-cy)*(sy-1)
     elif is_brow:
      if kind=='happy':dy=.018
      elif kind=='angry':dy=-.018+(x-cx)*(.25 if cx>0 else -.25)
      elif kind=='sad':dy=.018+(x-cx)*(-.25 if cx>0 else .25)
      elif kind=='surprise':dy=.035
     elif is_mouth:
      if 'Jaw' in name:
       if kind in ['talk','surprise']:dy=-.035
      else:
       if kind in ['talk','surprise']:
        dy=(y-cy)*1.2;dx=(x-cx)*(-.1)
       elif kind in ['happy','sad','angry']:
        sign=1 if kind=='happy' else -1
        dy=sign*.018*(min(1,abs(x-cx)/max(width/2,.001))**2)
     assert max(abs(dx),abs(dy),abs(dz))<.3,(name,kind)
     delta.extend([dx,dy,dz])
    p['targets'][ti]={'POSITION':append(delta)}
   report.append(dict(node=name,pivot=[cx,cy,cz],width=width,height=height))
 return write(d,bytes(bb)),report
if __name__=='__main__':
 catalog=json.loads((ROOT/'assets/character-catalog.json').read_text());reports=[]
 for c in catalog:
  if c['id'] not in ['mino-poppy','mino-tango','mino-mochi','mino-pixel','mino-kiki']:continue
  path=ROOT/('assets/'+c['id']+'.glb');b,r=repair(path.read_bytes());path.write_bytes(b);c['sha256']=hashlib.sha256(b).hexdigest();c['src']='/assets/'+path.name+'?face=2';reports.append(dict(id=c['id'],features=r))
 (ROOT/'assets/character-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8');l=json.loads((ROOT/'assets/animation-labels-cs.json').read_text());(ROOT/'assets/character-data.js').write_text('export const characters='+json.dumps(catalog,ensure_ascii=False)+';\nexport const labels='+json.dumps(l,ensure_ascii=False)+';\n',encoding='utf8');(ROOT/'docs/laya-qa/mino-face-repair.json').write_text(json.dumps(reports,indent=2),encoding='utf8');print('Repaired five models with local position deltas')

