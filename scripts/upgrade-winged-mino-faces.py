"""Add reversible authored NEX-style facial geometry to owner Mino winged copies.
Usage: python scripts/upgrade-winged-mino-faces.py INPUT.glb OUTPUT.glb
Only old front eyes/mouth lose their mesh references. All old meshes/binary and body
animation channels remain untouched. New face is rigidly parented to the head joint.
"""
import json,struct,math,pathlib,sys,copy,runpy,re
_helpers=runpy.run_path(str(pathlib.Path(__file__).with_name('import-mino-gallery.py')))
read,write=_helpers['read'],_helpers['write']
VISEMES=['viseme_A','viseme_E','viseme_I','viseme_O','viseme_U','viseme_MBP','viseme_FV','viseme_L','viseme_TDN','viseme_SZ','viseme_SH','viseme_KG','viseme_R']
SHAPES=['blink','happy','sad','angry','surprise','talk']+VISEMES
# outer width, inner half-height, tooth visibility, tongue height/visibility
MOUTH={'neutral':(.108,.008,0,0), 'happy':(.122,.014,.15,0),'sad':(.086,.006,0,0),'angry':(.098,.012,.6,0),'surprise':(.057,.058,.5,.2),'talk':(.092,.043,.6,.4),
 'viseme_A':(.094,.053,.6,.3),'viseme_E':(.121,.029,.9,.2),'viseme_I':(.128,.018,1,.15),'viseme_O':(.057,.049,.4,.25),'viseme_U':(.043,.034,.25,.2),
 'viseme_MBP':(.103,.0015,0,0),'viseme_FV':(.091,.018,1,0),'viseme_L':(.092,.044,.7,1),'viseme_TDN':(.094,.029,1,1),'viseme_SZ':(.105,.012,1,.15),'viseme_SH':(.062,.026,.8,.2),'viseme_KG':(.088,.04,.6,.4),'viseme_R':(.075,.029,.7,.8)}
def upgrade(blob):
 d,raw=read(blob);bb=bytearray(raw);old_nodes=copy.deepcopy(d['nodes']);old_animations=copy.deepcopy(d.get('animations',[]));original_meshes=copy.deepcopy(d['meshes']);report={}
 head=next(i for i,n in enumerate(d['nodes']) if n.get('name')=='head');hy=1.72
 number=int(re.search(r'\d+',d['nodes'][0].get('name','01')).group())
 variants=[('bevel',.138,.050,.00,[.10,.90,1]),('oval',.124,.067,.00,[.55,.82,1]),('bevel',.136,.047,.15,[1,.65,.72]),('hex',.132,.059,-.08,[.40,1,.72]),('oval',.142,.047,.05,[.28,.62,1]),('hex',.126,.061,.00,[1,.72,.22]),('oval',.131,.058,-.05,[.76,.50,1]),('bevel',.144,.045,.00,[.70,.90,1]),('hex',.137,.053,.06,[1,.86,.36]),('bevel',.130,.050,.19,[1,.22,.42]),('oval',.142,.049,-.09,[.36,.80,1]),('bevel',.132,.055,-.04,[.46,1,.89]),('hex',.135,.052,.00,[1,.75,.45]),('oval',.126,.064,.04,[.78,.86,1]),('bevel',.142,.046,-.14,[1,.45,.84])]
 style,eyeWidth,eyeHeight,slope,eyeColor=variants[(number-1)%15]
 report['eyeVariant']=dict(number=number,style=style,halfWidth=eyeWidth,halfHeight=eyeHeight,mirroredSlope=slope,color=eyeColor)
 # Existing head rest translation is 0.92+0.25+0.55. Verify rather than assume.
 parents={c:i for i,n in enumerate(d['nodes']) for c in n.get('children',[])};cur=head;wy=0
 while True:
  wy+=d['nodes'][cur].get('translation',[0,0,0])[1]
  if cur not in parents:break
  cur=parents[cur]
 assert abs(wy-hy)<1e-5,wy
 removed=[]
 for ni,n in enumerate(d['nodes']):
  if 'mesh' not in n or not n.get('name','').startswith('head_panel_'):continue
  m=d['meshes'][n['mesh']];pr=m['primitives'][0];a=d['accessors'][pr['attributes']['POSITION']];lo=a.get('min');hi=a.get('max')
  if lo and hi and lo[2]>.38 and 1.55<(lo[1]+hi[1])/2<2.1 and hi[0]-lo[0]<.36:
   removed.append({'node':ni,'name':n['name'],'mesh':n['mesh']});n.pop('mesh');n.pop('skin',None)
 def accessor(vals,size=3,component=5126,kind=None):
  nonlocal bb
  bb.extend(b'\0'*((-len(bb))%4));off=len(bb);fmt={5126:'f',5123:'H'}[component];bb.extend(struct.pack('<'+fmt*len(vals),*vals));view=len(d['bufferViews']);d['bufferViews'].append(dict(buffer=0,byteOffset=off,byteLength=len(vals)*struct.calcsize(fmt)))
  a=dict(bufferView=view,componentType=component,count=len(vals)//size,type=kind or {1:'SCALAR',3:'VEC3',4:'VEC4'}[size]);a['min']=[min(vals[k::size]) for k in range(size)];a['max']=[max(vals[k::size]) for k in range(size)];i=len(d['accessors']);d['accessors'].append(a);return i
 def mat(name,color,emission=0):
  i=len(d['materials']);d['materials'].append(dict(name=name,pbrMetallicRoughness=dict(baseColorFactor=[*color,1],metallicFactor=.25,roughnessFactor=.3),emissiveFactor=[v*emission for v in color],doubleSided=False));return i
 eyeMat=mat('Mino_NEX_Optics_'+str(number),eyeColor,.55);metalMat=mat('Mino_NEX_Mouth_Rim',[.55,.75,.80],.12);darkMat=mat('Mino_NEX_Mouth_Interior',[.012,.018,.026]);toothMat=mat('Mino_NEX_ToothPlate',[.80,.88,.90]);tongueMat=mat('Mino_NEX_Tongue',[.42,.08,.13])
 authored=[];max_delta=0
 def mesh(name,verts,indices,material,shape_fn):
  nonlocal max_delta
  flat=[v for p in verts for v in p];targets=[]
  for shape in SHAPES:
   coords=shape_fn(shape);assert len(coords)==len(verts)
   delta=[coords[i][k]-verts[i][k] for i in range(len(verts)) for k in range(3)];max_delta=max(max_delta,max(abs(v) for v in delta));assert max(abs(v) for v in delta)<.14,(name,shape)
   targets.append({'POSITION':accessor(delta)})
  pr=dict(attributes={'POSITION':accessor(flat),'NORMAL':accessor([v for _ in verts for v in [0,0,1]])},indices=accessor(indices,1,5123),material=material,targets=targets)
  mi=len(d['meshes']);d['meshes'].append(dict(name=name,primitives=[pr],weights=[0]*len(SHAPES),extras={'targetNames':SHAPES,'authoring':'Local deltas around each facial feature; Czech viseme groups'}));ni=len(d['nodes']);d['nodes'].append(dict(name=name,mesh=mi,weights=[0]*len(SHAPES)));d['nodes'][head].setdefault('children',[]).append(ni);authored.append(ni);return ni
 # Wider angular NEX eyes. Each has separate local pivot and genuine vertical closure.
 for side,cx in [('L',-.170),('R',.170)]:
  cy=1.845-hy;z=.476;w=eyeWidth;h=eyeHeight;bevel=.020
  if style=='oval':outline=[(w*math.cos(2*math.pi*i/32),h*math.sin(2*math.pi*i/32)) for i in range(32)]
  elif style=='hex':outline=[(-w*.68,-h),(w*.68,-h),(w,0),(w*.68,h),(-w*.68,h),(-w,0)]
  else:outline=[(-w+bevel,-h),(w-bevel,-h),(w,-h+bevel),(w,h-bevel),(w-bevel,h),(-w+bevel,h),(-w,h-bevel),(-w,-h+bevel)]
  outline=[(x,y+slope*x*(1 if cx<0 else -1)) for x,y in outline]
  verts=[(cx,cy,z)]+[(cx+x,cy+y,z) for x,y in outline];indices=[v for j in range(len(outline)) for v in [0,j+1,(j+1)%len(outline)+1]]
  def eye_shape(kind,verts=verts,cx=cx,cy=cy):
   out=[]
   for x,y,z in verts:
    sy={'blink':.035,'happy':.65,'sad':.8,'angry':.72,'surprise':1.14}.get(kind,1);dy=(y-cy)*(sy-1)
    if kind=='angry':dy+=(x-cx)*(.18 if cx>0 else -.18)
    if kind=='sad':dy+=(x-cx)*(-.12 if cx>0 else .12)
    out.append((x,y+dy,z))
   return out
  mesh('Mino_NEX_Eye_'+side,verts,indices,eyeMat,eye_shape)
  # Upper brow plates remain attached and move locally, independent of blink.
  by=cy+.087;v=[(cx-.13,by-.007,.472),(cx+.13,by-.007,.472),(cx+.13,by+.007,.472),(cx-.13,by+.007,.472)]
  def brow_shape(kind,v=v,cx=cx):
   return [(x,y+({'happy':.012,'sad':.014,'angry':-.012,'surprise':.025}.get(kind,0))+(x-cx)*((.20 if cx>0 else -.20) if kind=='angry' else (-.16 if cx>0 else .16) if kind=='sad' else 0),z) for x,y,z in v]
  mesh('Mino_NEX_Brow_'+side,v,[0,1,2,0,2,3],metalMat,brow_shape)
 # A separate mechanical aperture, upper tooth plate and tongue make viseme groups visible.
 my=1.628-hy;segments=32
 def aperture(kind='neutral',ring=False):
  w,h,tooth,tongue=MOUTH.get(kind,MOUTH['neutral']);curve=.012 if kind=='happy' else -.010 if kind=='sad' else 0
  points=[]
  if ring:
   for outer in [True,False]:
    rw=w+(.010 if outer else 0);rh=h+(.010 if outer else 0)
    for i in range(segments):
     a=2*math.pi*i/segments;x=rw*math.cos(a);y=rh*math.sin(a)+curve*(abs(math.cos(a))**2);points.append((x,my+y,.480))
  else:
   points=[(0,my,.478)]+[(w*math.cos(2*math.pi*i/segments),my+h*math.sin(2*math.pi*i/segments)+curve*abs(math.cos(2*math.pi*i/segments))**2,.478) for i in range(segments)]
  return points
 verts=aperture(ring=True);indices=[q for i in range(segments) for q in [i,(i+1)%segments,segments+i,(i+1)%segments,segments+(i+1)%segments,segments+i]]
 mesh('Mino_Face_Mouth_Rim',verts,indices,metalMat,lambda k:aperture(k,True))
 verts=aperture();mesh('Mino_Face_Mouth',verts,[q for i in range(segments) for q in [0,i+1,(i+1)%segments+1]],darkMat,lambda k:aperture(k))
 def plate(kind='neutral',tongue=False):
  w,h,t,lg=MOUTH.get(kind,MOUTH['neutral']);amount=lg if tongue else t
  # Collapsed neutral geometry is hidden inside the slot. Targets expand locally.
  ww=(.032 if tongue else min(w*.8,.083))*amount
  hh=(.010 if tongue else .008)*amount
  yy=my+(h*.10 if kind in ['viseme_L','viseme_TDN'] else -h*.30) if tongue else my+h*.67
  if not amount:yy=my
  return [(-ww,yy-hh,.481),(ww,yy-hh,.481),(ww,yy+hh,.481),(-ww,yy+hh,.481)]
 for tongue in [False,True]:mesh('Mino_Face_Tongue' if tongue else 'Mino_Face_Teeth',plate(tongue=tongue),[0,1,2,0,2,3],tongueMat if tongue else toothMat,lambda k,t=tongue:plate(k,t))
 # Standalone authored clips coexist with all original body animations.
 labels={'blink':'Mimika – Mrkání','happy':'Mimika – Radost','sad':'Mimika – Smutek','angry':'Mimika – Hněv','surprise':'Mimika – Překvapení','talk':'Mimika – Mluva'}
 for v in VISEMES:labels[v]='Řeč – '+v.removeprefix('viseme_').replace('MBP','M B P').replace('TDN','T D N').replace('SZ','S Z').replace('SH','Š Ž Č Dž').replace('KG','K G Ch H').replace('FV','F V')
 times=accessor([0,.25,.5,1.25,1.75,2.0],1)
 for shape,label in labels.items():
  channels=[];samplers=[];which=SHAPES.index(shape)
  for node in authored:
   vals=[]
   for amp in [0,0,1,1,0,0]:
    weights=[0.]*len(SHAPES);weights[which]=amp;vals.extend(weights)
   oi=accessor(vals,1);samplers.append(dict(input=times,output=oi,interpolation='LINEAR'));channels.append(dict(sampler=len(samplers)-1,target=dict(node=node,path='weights')))
  d.setdefault('animations',[]).append(dict(name=label,samplers=samplers,channels=channels))
 assert d['meshes'][:len(original_meshes)]==original_meshes
 assert d['animations'][:len(old_animations)]==old_animations
 for i,n in enumerate(old_nodes):
  if i in [v['node'] for v in removed] or i==head:continue
  assert d['nodes'][i]==n,(i,n.get('name'))
 report.update(removedFacialMeshes=removed,newFacialNodes=[d['nodes'][i]['name'] for i in authored],twoEyes=True,visemes=VISEMES,standaloneFacialClips=len(labels),maxLocalDelta=max_delta,bodyClipsPreserved=len(old_animations),newTotalClips=len(d['animations']),headParent=head,headRestY=wy,limitations='Articulated robot mouth visemes, not audio forced alignment; closed-eye shape is compressed emissive aperture.')
 return write(d,bytes(bb)),report
if __name__=='__main__':
 if len(sys.argv)!=3:raise SystemExit(__doc__)
 source,target=map(pathlib.Path,sys.argv[1:]);assert source.resolve()!=target.resolve(),'Keep the original immutable'
 b,report=upgrade(source.read_bytes());target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);target.with_suffix('.face-qa.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8');print(json.dumps({'output':str(target),**report},ensure_ascii=False))
