"""Add two small facial morphs to derived web copies; source game files stay intact."""
from pathlib import Path
import struct,json,array,sys
for id,eyes,mouth in [('holographic',[17,18,29,30],43),('rose',[17,18,19,30,31,32],43)]:
 src=Path('assets/showcase-'+id+'.glb');b=src.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);off=20+n;size=struct.unpack_from('<I',b,off)[0];binary=bytearray(b[off+8:off+8+size])
 for node in g['nodes']:
  if node.get('name') not in ['head_panel_'+str(i) for i in eyes+[mouth]]:continue
  mesh=g['meshes'][node['mesh']];mesh['extras']={'targetNames':['web_blink','web_talk']};mesh['weights']=[0,0]
  for p in mesh['primitives']:
   a=g['accessors'][p['attributes']['POSITION']];v=g['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);pos=[struct.unpack_from('<fff',binary,start+i*stride) for i in range(a['count'])];cy=(a['min'][1]+a['max'][1])/2;targets=[]
   for kind in ['blink','talk']:
    out=[]
    for x,y,z in pos:
     delta=0
     if kind=='blink' and node['name']!='head_panel_'+str(mouth):delta=(cy-y)*.95
     if kind=='talk' and node['name']=='head_panel_'+str(mouth) and (id!='holographic' or y<1.69):delta=(y-1.63)*1.6
     out.extend([0,delta,0])
    while len(binary)%4:binary.append(0)
    offset=len(binary);raw=struct.pack('<'+'f'*len(out),*out);binary.extend(raw);view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw),'target':34962});acc=len(g['accessors']);g['accessors'].append({'bufferView':view,'componentType':5126,'count':len(pos),'type':'VEC3','min':[min(out[i::3]) for i in range(3)],'max':[max(out[i::3]) for i in range(3)]});targets.append({'POSITION':acc})
   p['targets']=targets
 g['buffers'][0]['byteLength']=len(binary);j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4);total=12+8+len(j)+8+len(binary);dest=Path('assets/showcase-'+id+'-face.glb');dest.write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary);print(dest,len(binary))
