// Offline playback QA using the Studio's existing Three.js dependency.
import fs from 'node:fs';
import * as T from '../../../NexVerseAIStudio/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../../NexVerseAIStudio/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const catalog=fs.readdirSync('assets').filter(n=>/^(classic-|mino-).*\.glb$/.test(n)).map(n=>({id:n.slice(0,-4),src:'/assets/'+n}));
const reports=[];
for(const c of catalog.filter(c=>/^(classic-|mino-)/.test(c.id))){
 const b=fs.readFileSync('.'+c.src);const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 if(g.animations.length<109)throw Error(c.id+' missing clips');
 const mixer=new T.AnimationMixer(g.scene);let sampled=0;g.scene.updateMatrixWorld(true);const base=new T.Box3().setFromObject(g.scene).getSize(new T.Vector3()).length();let max=0;
 for(const clip of g.animations){
  mixer.stopAllAction();const a=mixer.clipAction(clip);a.reset().play();
  for(const frac of [0,.25,.5,.75,1]){a.time=clip.duration*frac;mixer.update(0);g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.matrixWorld.elements.some(v=>!Number.isFinite(v)))throw Error(c.id+' nonfinite '+clip.name)});const span=new T.Box3().setFromObject(g.scene).getSize(new T.Vector3()).length();max=Math.max(max,span);if(!Number.isFinite(span)||span>base*4)throw Error(c.id+' exploding '+clip.name);sampled++}
 }
 reports.push({id:c.id,clips:g.animations.length,sampled,baseBounds:base,maxBounds:max});console.log(c.id,g.animations.length,'clips,',sampled,'finite playback samples');
}
fs.writeFileSync('docs/laya-qa/mino-playback-report.json',JSON.stringify({reports,limits:'Five samples per clip; finite transforms and bounds, not exhaustive per-frame visual certification.'},null,2));

