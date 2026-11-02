"""Upgrade authored winged Mino copies without touching source assets.
CLI: python scripts/upgrade-mino-wings.py input.glb output.glb [--report report.json]
Existing body animation channels remain byte-for-byte referenced. Existing wing channels
are preserved; compatible secondary movement is added where absent. Five flight clips
adapt the owner's MinoBuddy src/wing-rig.js timings to these existing two-joint wings.
Only 03/09 feather geometry is re-profiled; original layering/materials/shimmer retained.
"""
import argparse,copy,json,math,pathlib,struct

def read(blob):
 assert blob[:4]==b'glTF' and struct.unpack_from('<I',blob,4)[0]==2
 size=struct.unpack_from('<I',blob,12)[0];return json.loads(blob[20:20+size]),bytearray(blob[28+size:])
def write(d,b):
 d['buffers'][0]['byteLength']=len(b);j=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*(-len(j)%4);b=bytes(b)+b'\0'*(-len(b)%4)
 return struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b

def upgrade(blob):
 d,bb=read(blob);original=copy.deepcopy(d);nodes={n.get('name'):i for i,n in enumerate(d['nodes'])};required=['wingL','wingTipL','wingR','wingTipR'];assert all(n in nodes for n in required)
 original_clips=copy.deepcopy(d.get('animations',[]));skin=d['skins'][0];joint={name:skin['joints'].index(nodes[name]) for name in required};modified=[]
 def accessor(values,kind='VEC3',component=5126):
  dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[kind];fmt={5126:'f',5123:'H',5125:'I'}[component];bb.extend(b'\0'*(-len(bb)%4));off=len(bb);bb.extend(struct.pack('<'+fmt*len(values),*values));vi=len(d['bufferViews']);d['bufferViews'].append(dict(buffer=0,byteOffset=off,byteLength=len(bb)-off));a=dict(bufferView=vi,componentType=component,count=len(values)//dims,type=kind)
  if component==5126:a.update(min=[min(values[k::dims]) for k in range(dims)],max=[max(values[k::dims]) for k in range(dims)])
  index=len(d['accessors']);d['accessors'].append(a);return index
 def duration(clip):return max(d['accessors'][s['input']].get('max',[0])[0] for s in clip['samplers'])
 def quat(x,y,z):
  c1,c2,c3=[math.cos(v/2) for v in [x,y,z]];s1,s2,s3=[math.sin(v/2) for v in [x,y,z]]
  return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3]
 def track(clip,node,path,times,values,kind):
  sampler=len(clip['samplers']);clip['samplers'].append(dict(input=accessor(times,'SCALAR'),output=accessor(values,kind),interpolation='LINEAR'));clip['channels'].append(dict(sampler=sampler,target=dict(node=nodes[node],path=path)))
 # A secondary wing layer is baked into every existing clip without replacing body channels.
 added=0
 for clip in d['animations']:
  dur=duration(clip);existing={(c['target']['node'],c['target']['path']) for c in clip['channels']};name=clip['name'].lower();cycles=max(1,round(dur*(1.9 if any(k in name for k in ['run','beh','sprint']) else 1.2)))
  amp=.10 if any(k in name for k in ['run','beh','sprint']) else .06 if any(k in name for k in ['walk','chuz','jog']) else .035
  if any(k in name for k in ['death','ko','lay','sit']):amp=.018
  if 'pose' in name:amp=0
  samples=max(20,min(240,math.ceil(dur*30)));times=[dur*i/samples for i in range(samples+1)]
  for side,sign in [('L',1),('R',-1)]:
   for is_tip,key in [(False,'wing'+side),(True,'wingTip'+side)]:
    if (nodes[key],'rotation') in existing:continue
    vals=[]
    for t in times:
     phase=t/max(dur,.001)*math.tau*cycles;lag=.45 if is_tip else 0
     flap=amp*(.55 if is_tip else 1)*math.sin(phase-lag);fold=.075+.018*math.cos(phase-lag)
     vals.extend(quat(.015*math.sin(phase),sign*fold*(.6 if is_tip else 1),sign*flap))
    track(clip,key,'rotation',times,vals,'VEC4');added+=1
 # Existing authored mechanical joints and skin bindings are retained.
 smooth=lambda v:(lambda x:x*x*(3-2*x))(max(0,min(1,v)))
 flight=[];base=d['nodes'][nodes['hips']].get('translation',[0,.92,0]);names={a['name'] for a in d['animations']}
 for id,label,dur in [('takeoff','Vzlet vzhůru',2.2),('fly','Let – mávání křídly',1.4),('land','Přistání',2.2),('dive','Útok náletem vpřed',1.2),('wing_dodge','Úskok s křídly vzad',1.1)]:
  if id in names:continue
  clip={'name':id,'samplers':[],'channels':[],'extras':{'label_cs':label,'authoredBy':'MORFIAI','source':'owner MinoBuddy wing-rig.js; adapted to Mino two-joint wings'}};times=[dur*i/80 for i in range(81)];hips=[];qs={key:[] for key in required};legs={key:[] for key in ['legL','legR','shinL','shinR','armL','armR']}
  for t in times:
   u=t/dur;y=z=fold=flap=0
   if id=='fly':y=.65+.035*math.sin(u*math.tau);flap=.60*math.sin(u*math.tau)
   elif id=='takeoff':y=-.1*math.sin(math.pi*min(1,u/.3))+.65*smooth((u-.15)/.7);flap=.7*math.sin(u*math.tau*2)*math.sin(math.pi*u);fold=.2*(1-smooth(u/.3))
   elif id=='land':y=.65*(1-smooth(u/.8))-.1*math.sin(math.pi*max(0,min(1,(u-.7)/.3)));flap=.4*math.sin(u*math.tau*2)*(1-u);fold=.2*smooth((u-.75)/.25)
   else:z=(1.25 if id=='dive' else -.85)*smooth((u-.18)/.38);y=.25*math.sin(math.pi*u);flap=.6*smooth(u/.2) if u<.2 else -.75*math.sin(math.pi*max(0,min(1,(u-.2)/.55)));fold=.2*smooth((u-.7)/.3)
   hips.extend([base[0],base[1]+y,base[2]+z]);lift=max(0,min(1,y/.5))
   for side,sign in [('L',1),('R',-1)]:
    qs['wing'+side].extend(quat(0,sign*fold,sign*flap));qs['wingTip'+side].extend(quat(0,sign*(fold*.6+.04),sign*.25*math.sin(t/dur*math.tau-.45) if id=='fly' else sign*flap*.35))
    legs['leg'+side].extend(quat(-.16*lift,0,sign*.035*lift));legs['shin'+side].extend(quat(.25*lift,0,0));legs['arm'+side].extend(quat(.06*lift,0,sign*.16*lift))
  track(clip,'hips','translation',times,hips,'VEC3')
  for key,values in {**qs,**legs}.items():track(clip,key,'rotation',times,values,'VEC4')
  d['animations'].append(clip);flight.append(id)
 # 03/09's radial flat fans become swept, supported mechanical feather wings.
 # Retain planar overlapping decorative feather layers and materials by user request.
 species=str(d['nodes'][0].get('name',''));repair_feathers=species in ['03','09']
 def generated_primitive(verts,triangles,material,side):
  pos=[];norm=[];joints=[];weights=[];a=joint['wing'+side];b=joint['wingTip'+side]
  for tri in triangles:
   p,q,r=[verts[i] for i in tri];u=[q[k]-p[k] for k in range(3)];v=[r[k]-p[k] for k in range(3)];normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=max(1e-9,math.sqrt(sum(x*x for x in normal)));normal=[x/length for x in normal]
   for i in tri:
    point=verts[i];pos.extend(point);norm.extend(normal);outer=smooth((abs(point[0])-.52)/.65);joints.extend([a,b,0,0]);weights.extend([1-outer,outer,0,0])
  return dict(attributes={'POSITION':accessor(pos),'NORMAL':accessor(norm),'JOINTS_0':accessor(joints,'VEC4',5123),'WEIGHTS_0':accessor(weights,'VEC4')},material=material,mode=4)
 def prism(poly,z,thickness):
  verts=[[x,y,z+thickness/2] for x,y in poly]+[[x,y,z-thickness/2] for x,y in poly];n=len(poly);tri=[]
  for i in range(1,n-1):tri.extend([(0,i,i+1),(n,n+i+1,n+i)])
  for i in range(n):j=(i+1)%n;tri.extend([(i,n+i,n+j),(i,n+j,j)])
  return verts,tri
 def cylinder(start,end,radius=.008):
  direction=[end[k]-start[k] for k in range(3)];length=math.sqrt(sum(x*x for x in direction));direction=[x/length for x in direction];u=[-direction[1],direction[0],0];l=math.sqrt(sum(x*x for x in u));u=[x/l for x in u];v=[direction[1]*u[2]-direction[2]*u[1],direction[2]*u[0]-direction[0]*u[2],direction[0]*u[1]-direction[1]*u[0]];verts=[]
  for p in [start,end]:
   for i in range(8):a=i/8*math.tau;verts.append([p[k]+radius*(math.cos(a)*u[k]+math.sin(a)*v[k]) for k in range(3)])
  tri=[]
  for i in range(8):j=(i+1)%8;tri.extend([(i,j,8+j),(i,8+j,8+i)])
  return verts,tri
 if repair_feathers:
  counters={'L':0,'R':0};shaft={'L':0,'R':0}
  for node in d['nodes']:
   if 'mesh' not in node:continue
   name=node.get('name','');m=d['meshes'][node['mesh']]
   if name not in ['FeatherWingBase','LayeredFeather','FeatherShaft']:continue
   old=m['primitives'][0];bounds=d['accessors'][old['attributes']['POSITION']];sign=1 if sum(bounds['min'][0:1]+bounds['max'][0:1])>0 else -1;side='L' if sign>0 else 'R';mat=old['material']
   if name=='FeatherWingBase':
    poly=[(.23,1.33),(.56,1.56),(1.31,1.85),(1.24,1.67),(.62,1.37),(.32,1.20)];verts,tri=prism([(sign*x,y) for x,y in poly],-.27,.038)
   else:
    index=counters[side] if name=='LayeredFeather' else shaft[side];rx=.50+.075*index;ry=1.50+.035*index;tx=.65+.11*index;ty=1.12+.055*index;width=.085-index*.003
    if name=='LayeredFeather':
     counters[side]+=1;dx,dy=tx-rx,ty-ry;ln=math.hypot(dx,dy);nx,ny=-dy/ln*width,dx/ln*width;poly=[(rx,ry),(rx+dx*.28+nx,ry+dy*.28+ny),(tx,ty),(rx+dx*.28-nx,ry+dy*.28-ny)];verts=[[sign*x,y,-.215] for x,y in poly];tri=[(0,1,2),(0,2,3)]
    else:shaft[side]+=1;verts,tri=cylinder([sign*rx,ry,-.208],[sign*tx,ty,-.208])
   if sign<0:tri=[tuple(reversed(t)) for t in tri]
   m['primitives']=[generated_primitive(verts,tri,mat,side)];modified.append(dict(node=name,side=side))
 d['nodes'][0].setdefault('extras',{}).update(wingUpgrade='secondary motion + flight presets; original shimmer retained',animationCount=len(d['animations']))
 # Original body channels and samplers remain untouched as prefixes.
 for old,new in zip(original_clips,d['animations']):
  assert new['channels'][:len(old['channels'])]==old['channels'];assert new['samplers'][:len(old['samplers'])]==old['samplers']
 assert d['skins']==original['skins'];assert d['materials']==original['materials']
 return write(d,bb),dict(sourceClips=len(original_clips),outputClips=len(d['animations']),secondaryWingTracksAdded=added,flightClipsAdded=flight,featherGeometryReprofiled=modified,shimmerPreserved=True,skinsAndMaterialsUnchanged=True,bodyTracksPreserved=True)

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('input');ap.add_argument('output');ap.add_argument('--report');args=ap.parse_args();p=pathlib.Path(args.input);out=pathlib.Path(args.output);assert p.resolve()!=out.resolve(),'Use a new copy';result,report=upgrade(p.read_bytes());out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(result)
 if args.report:pathlib.Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 print(json.dumps(report,ensure_ascii=False))
