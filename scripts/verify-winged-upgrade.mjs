import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../NexVerseAIStudio/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../../NexVerseAIStudio/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const dir='H:/NexVerse-task-backups/winged-mino-20261102';
async function load(path){const b=fs.readFileSync(path);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}
const reports=[];
for(let i=1;i<=15;i++){
 const id='mino-'+String(i).padStart(2,'0'),g=await load(`${dir}/staging/${id}.glb`),old=await load(`${dir}/originals/${id}.glb`);
 let checkedTracks=0;
 for(const clip of old.animations){const n=g.animations.find(c=>c.name===clip.name);assert.ok(n,clip.name);for(const tr of clip.tracks){const nt=n.tracks.find(t=>t.name===tr.name);assert.ok(nt,tr.name);assert.deepEqual(nt.times,tr.times);assert.deepEqual(nt.values,tr.values);checkedTracks++}}
 const head=g.scene.getObjectByName('head'),eyes=['L','R'].map(s=>g.scene.getObjectByName('Mino_NEX_Eye_'+s));assert.ok(eyes.every(e=>e&&e.parent===head));
 let morphs=0;const v=new T.Vector3();g.scene.traverse(o=>{if(!o.isMesh||!o.name.startsWith('Mino_'))return;assert.ok(o.morphTargetDictionary);const p=o.geometry.attributes.position;for(let k=0;k<o.morphTargetInfluences.length;k++){o.morphTargetInfluences.fill(0);o.morphTargetInfluences[k]=1;let max=0;for(let j=0;j<p.count;j++){o.getVertexPosition(j,v);max=Math.max(max,Math.hypot(v.x-p.getX(j),v.y-p.getY(j),v.z-p.getZ(j)))}assert.ok(max<.2,o.name+' morph escaping face');morphs++}o.morphTargetInfluences.fill(0)});
 const mixer=new T.AnimationMixer(g.scene);g.scene.updateMatrixWorld(true);const originalSpan=new T.Box3().setFromObject(g.scene).getSize(v).length();let samples=0,maxSpan=0;
 for(const c of g.animations){mixer.stopAllAction();const a=mixer.clipAction(c);a.reset().play();for(const u of [0,.25,.5,.75,.999]){a.time=c.duration*u;mixer.update(0);g.scene.updateMatrixWorld(true);g.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),id+' '+c.name));const span=new T.Box3().setFromObject(g.scene).getSize(v).length();assert.ok(Number.isFinite(span)&&span<originalSpan*3,id+' exploding '+c.name);maxSpan=Math.max(maxSpan,span);samples++}}
 for(const name of ['walk','run','fly','takeoff','land']){const c=g.animations.find(c=>c.name===name);assert.ok(c,name);for(const side of ['L','R']){const tr=c.tracks.find(t=>t.name==='wing'+side+'.quaternion');assert.ok(tr,id+' no wingmotion '+name);assert.ok(tr.values.some((x,i)=>i>=4&&Math.abs(x-tr.values[i%4])>1e-4),id+' static wing '+name)}}
 const report={id,clips:g.animations.length,originalBodyTracksPreserved:checkedTracks,facialTargetsChecked:morphs,twoHeadParentedEyes:true,animationSamples:samples,maxSpan};reports.push(report);console.log(JSON.stringify(report));
}
fs.writeFileSync('docs/laya-qa/winged-integration-qa.json',JSON.stringify({reports,limits:'All original tracks exact; all facial targets bounded; sampled animation transforms/bounds, not all-frame contact QA.'},null,2));
