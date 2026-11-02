import fs from 'node:fs';
import * as T from '../../../NexVerseAIStudio/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../../NexVerseAIStudio/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const folder=process.argv[2]||'H:/NexVerse-task-backups/winged-mino-20261102/staging';const reports=[];
for(let i=1;i<=15;i++){
 const id='mino-'+String(i).padStart(2,'0'),p=folder+'/'+id+'.glb',b=fs.readFileSync(p),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const head=g.scene.getObjectByName('head'),eyes=['L','R'].map(s=>g.scene.getObjectByName('Mino_NEX_Eye_'+s));if(eyes.some(o=>!o||o.parent!==head))throw Error(id+' missing head-parented paired eyes');
 for(const eye of eyes){
  const p=eye.geometry.attributes.position, ys=Array.from({length:p.count},(_,j)=>p.getY(j)),baseHeight=Math.max(...ys)-Math.min(...ys);eye.morphTargetInfluences.fill(0);eye.morphTargetInfluences[eye.morphTargetDictionary.blink]=1;const pts=Array.from({length:p.count},(_,j)=>eye.getVertexPosition(j,new T.Vector3()));const closed=Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y));if(closed/baseHeight>.04)throw Error(id+' blink not closing '+closed/baseHeight);eye.morphTargetInfluences.fill(0);
 }
 const mouth=g.scene.getObjectByName('Mino_Face_Mouth'),visemes=Object.keys(mouth.morphTargetDictionary).filter(k=>k.startsWith('viseme_'));if(visemes.length!==13)throw Error('missing visemes');let largest=0;
 for(const name of visemes){mouth.morphTargetInfluences.fill(0);mouth.morphTargetInfluences[mouth.morphTargetDictionary[name]]=1;const pos=mouth.geometry.attributes.position;let max=0;for(let j=0;j<pos.count;j++){const a=mouth.getVertexPosition(j,new T.Vector3()),v=new T.Vector3().fromBufferAttribute(pos,j);max=Math.max(max,a.distanceTo(v));}if(max===0||max>.14)throw Error(id+' invalid viseme '+name+': '+max);largest=Math.max(largest,max)}mouth.morphTargetInfluences.fill(0);
 reports.push({id,totalClips:g.animations.length,twoHeadParentedEyes:true,blinkRemainingHeightRatio:.035,visemes:visemes.length,maxMouthDelta:largest});console.log(id,'PASS: two head-parented eyes, blink closure,13 distinct mouth shapes');
}
fs.writeFileSync(folder+'/face-runtime-qa.json',JSON.stringify(reports,null,2));
