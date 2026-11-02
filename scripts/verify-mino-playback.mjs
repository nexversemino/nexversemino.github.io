// Offline playback QA using the Studio's existing Three.js dependency.
import fs from 'node:fs';
import * as T from '../../../NexVerseAIStudio/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../../NexVerseAIStudio/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const catalog=fs.readdirSync('assets').filter(n=>/^(classic-|mino-).*\.glb$/.test(n)).map(n=>({id:n.slice(0,-4),src:'/assets/'+n}));
const reports=[];
for(const c of catalog.filter(c=>/^(classic-|mino-)/.test(c.id))){
 const b=fs.readFileSync('.'+c.src);const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 if(g.animations.length<109)throw Error(c.id+' missing clips');
 let facialTargets=0;
 g.scene.traverse(o=>{if(!o.isMesh||!o.morphTargetInfluences)return;const pos=o.geometry.attributes.position;
  for(let k=0;k<o.morphTargetInfluences.length;k++){o.morphTargetInfluences.fill(0);o.morphTargetInfluences[k]=1;let dx=0,dy=0,dz=0,maxMove=0;const v=new T.Vector3();
   for(let j=0;j<pos.count;j++){o.getVertexPosition(j,v);const x=v.x-pos.getX(j),y=v.y-pos.getY(j),z=v.z-pos.getZ(j);dx+=x;dy+=y;dz+=z;maxMove=Math.max(maxMove,Math.hypot(x,y,z))}
   const shift=Math.hypot(dx,dy,dz)/pos.count;if(shift>.06||maxMove>.3)throw Error(c.id+' facial displacement '+shift+' / '+maxMove);facialTargets++;
  }o.morphTargetInfluences.fill(0);
 });
 const mixer=new T.AnimationMixer(g.scene);let sampled=0;g.scene.updateMatrixWorld(true);const base=new T.Box3().setFromObject(g.scene).getSize(new T.Vector3()).length();let max=0;
 for(const clip of g.animations){
  mixer.stopAllAction();const a=mixer.clipAction(clip);a.reset().play();
  for(const frac of [0,.25,.5,.75,1]){a.time=clip.duration*frac;mixer.update(0);g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.matrixWorld.elements.some(v=>!Number.isFinite(v)))throw Error(c.id+' nonfinite '+clip.name)});const span=new T.Box3().setFromObject(g.scene).getSize(new T.Vector3()).length();max=Math.max(max,span);if(!Number.isFinite(span)||span>base*4)throw Error(c.id+' exploding '+clip.name);sampled++}
 }
 reports.push({id:c.id,clips:g.animations.length,sampled,facialTargets,baseBounds:base,maxBounds:max});console.log(c.id,g.animations.length,'clips,',sampled,'finite playback samples');
}
fs.writeFileSync('docs/laya-qa/mino-playback-report.json',JSON.stringify({reports,limits:'Five samples per clip; finite transforms and bounds, not exhaustive per-frame visual certification.'},null,2));

