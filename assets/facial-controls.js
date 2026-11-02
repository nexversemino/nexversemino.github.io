// Silent Czech articulation demonstration. These are visual mouth families,
// not one unique visible shape per consonant and not audio-synchronised lip sync.
// Czech spelling -> visible articulation families. Several consonants are
// visually indistinguishable without sound (e.g. P/B/M or T/D/N).
export const speechPhonemeGroups={
 A:['A'],Á:['A'],E:['E'],É:['E'],Ě:['I','E'],I:['I'],Í:['I'],Y:['I'],Ý:['I'],O:['O'],Ó:['O'],U:['U'],Ú:['U'],Ů:['U'],
 M:['MBP'],B:['MBP'],P:['MBP'],F:['FV'],V:['FV'],L:['L'],
 T:['TDN'],D:['TDN'],N:['TDN'],Ť:['TDN'],Ď:['TDN'],Ň:['TDN'],
 S:['SZ'],Z:['SZ'],C:['TDN','SZ'],Š:['SH'],Ž:['SH'],Č:['TDN','SH'],
 R:['R'],Ř:['R','SH'],K:['KG'],G:['KG'],CH:['KG'],H:['KG'],J:['I'],
 Q:['KG'],W:['FV'],X:['KG','SZ']
};
const speechSteps=[
 ['MBP',.12],['A',.2],['MBP',.1],['A',.17],['REST',.1],
 ['FV',.13],['I',.17],['TDN',.11],['E',.18],['L',.12],['A',.19],
 ['SZ',.14],['I',.16],['SH',.14],['E',.18],['KG',.12],['O',.19],
 ['R',.14],['U',.21],['TDN',.1],['A',.18],['REST',.32]
];
const speechDuration=speechSteps.reduce((n,s)=>n+s[1],0);
const jawOpening={MBP:.025,FV:.12,L:.44,TDN:.26,SZ:.17,SH:.24,KG:.38,R:.28,A:.86,E:.52,I:.3,O:.7,U:.36,REST:0};
export function speechFrame(seconds){
 let phase=((seconds%speechDuration)+speechDuration)%speechDuration,index=0;
 while(phase>=speechSteps[index][1]&&index<speechSteps.length-1){phase-=speechSteps[index][1];index++}
 const current=speechSteps[index][0],previous=speechSteps[(index+speechSteps.length-1)%speechSteps.length][0];
 const x=Math.min(1,phase/.055),blend=x*x*(3-2*x),weights={};
 if(previous!=='REST')weights[previous]=(1-blend)*.88;
 if(current!=='REST')weights[current]=(weights[current]||0)+blend*.88;
 return {group:current,weights,jaw:(jawOpening[previous]*(1-blend)+jawOpening[current]*blend)*.88,duration:speechDuration};
}
// Additive facial controls, applied after the body mixer without replacing its clip.
export function bindFace(scene,character,blinkInput,talkInput,wrap,emotionInput,angerEyeNames=[]){
 const emotionPatterns={joy:/^(mouthSmile|happy|joy)$/i,sad:/^(mouthFrown|sad)$/i,angry:/^(browDownLeft|browDownRight|angry)$/i,cry:/^(cry|tear)$/i,surprise:/^(surprise|mouthFunnel)$/i};
 const bindings=[],eyeBindings=[];let disposed=false,frame,eyeAngry;
 const wantedEyes=new Set(angerEyeNames);
 scene.model.traverse(mesh=>{if(!wantedEyes.has(mesh.name)||!mesh.material)return;const original=mesh.material,materials=Array.isArray(original)?original:[original];const clones=materials.map(m=>m.clone());mesh.material=Array.isArray(original)?clones:clones[0];eyeBindings.push({mesh,original,materials,clones})});

 // Monstrum's six irises share a textured body mesh. Mask only vertices belonging
 // to its authored blink targets; replacing the entire material would tint armor.
 if(character==='robot-b')scene.model.traverse(mesh=>{
  const dict=mesh.morphTargetDictionary,geo=mesh.geometry;if(!dict||!geo?.attributes?.position)return;
  const targets=Object.keys(dict).filter(n=>/^Eye\d+Blink$/.test(n)).map(n=>geo.morphAttributes.position[dict[n]]);if(!targets.length)return;
  const originalGeometry=geo,copy=geo.clone(),mask=geo.attributes.position.clone();mask.array.fill(0);
  for(let i=0;i<mask.count;i++)if(targets.some(a=>Math.abs(a.getX(i))+Math.abs(a.getY(i))+Math.abs(a.getZ(i))>.00001))mask.setX(i,1);
  copy.setAttribute('angerEyeMask',mask);mesh.geometry=copy;const original=mesh.material,materials=Array.isArray(original)?original:[original],amount={value:0};
  const clones=materials.map(source=>{const material=source.clone(),before=source.onBeforeCompile;material.onBeforeCompile=function(shader,...args){before?.call(this,shader,...args);shader.uniforms.angerEyeAmount=amount;shader.vertexShader='attribute vec3 angerEyeMask; varying float vAngerEyeMask;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAngerEyeMask=angerEyeMask.x;');shader.fragmentShader='varying float vAngerEyeMask; uniform float angerEyeAmount;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,0.02,0.04),clamp(vAngerEyeMask*angerEyeAmount,0.0,1.0));')};material.customProgramCacheKey=()=> 'morfiai-six-eye-anger-v1';return material});
  mesh.material=Array.isArray(original)?clones:clones[0];eyeBindings.push({mesh,original,materials,clones,masked:true,amount,originalGeometry,copy});
 });
 function colorEyes(){const angry=emotionInput?.value==='angry';if(angry===eyeAngry)return;eyeAngry=angry;for(const b of eyeBindings){if(b.masked){b.amount.value=angry?1:0;continue}for(let i=0;i<b.clones.length;i++){const m=b.clones[i],source=b.materials[i];if(angry){m.color?.set('#ff1828');m.emissive?.set('#ff101c');m.emissiveIntensity=.9;m.vertexColors=false}else{m.color?.copy(source.color);m.emissive?.copy(source.emissive);m.emissiveIntensity=source.emissiveIntensity;m.vertexColors=source.vertexColors}m.needsUpdate=true}}wrap.dataset.faceAngryEyes=String(angry?eyeBindings.filter(b=>!b.masked).length:0)}
 scene.model.traverse(mesh=>{
  const d=mesh.morphTargetDictionary,w=mesh.morphTargetInfluences;if(!d||!w)return;
  const blink=Object.keys(d).filter(n=>character==='robot-b'?/^Eye\d+Blink$/.test(n):/^(blink|web_blink|eyeBlinkLeft|eyeBlinkRight)$/i.test(n));
  const talk=Object.keys(d).filter(n=>/^(talk|web_talk|jawOpen)$/i.test(n)||(character==='laya'&&/mouth/i.test(mesh.name)&&n==='surprise'));
  const visemes=Object.fromEntries(Object.keys(d).filter(n=>/^viseme_(A|E|I|O|U|MBP|FV|L|TDN|SZ|SH|KG|R)$/i.test(n)).map(n=>[n.slice(7).toUpperCase(),d[n]]));
  const emotions=Object.fromEntries(Object.entries(emotionPatterns).map(([kind,pattern])=>[kind,Object.keys(d).filter(n=>pattern.test(n)).map(n=>d[n])]));
  if(!blink.length&&!talk.length&&!Object.keys(visemes).length&&!Object.values(emotions).some(a=>a.length))return;
  const indices=[...new Set([...blink.map(n=>d[n]),...talk.map(n=>d[n]),...Object.values(visemes),...Object.values(emotions).flat()])];const base=new Map(indices.map(i=>[i,w[i]]));const before=mesh.onBeforeRender;
  const b={mesh,blink:blink.map(n=>d[n]),talk:talk.map(n=>d[n]),visemes,emotions,base,before};bindings.push(b);
  mesh.onBeforeRender=function(...args){before?.apply(this,args);apply(b,performance.now()/1000)};
 });
 const blinkCount=bindings.reduce((n,b)=>n+b.blink.length,0),talkCount=bindings.reduce((n,b)=>n+b.talk.length+Object.keys(b.visemes).length,0);
 blinkInput.disabled=!blinkCount;talkInput.disabled=!talkCount;wrap.dataset.faceBlinkTargets=String(blinkCount);wrap.dataset.faceTalkTargets=String(talkCount);wrap.dataset.faceVisemeTargets=String(bindings.reduce((n,b)=>n+Object.keys(b.visemes).length,0));
 if(emotionInput){for(const option of emotionInput.options)if(option.value!=='none')option.disabled=!(bindings.some(b=>b.emotions[option.value]?.length)||(option.value==='angry'&&eyeBindings.length));if(!(bindings.some(b=>b.emotions[emotionInput.value]?.length)||(emotionInput.value==='angry'&&eyeBindings.length)))emotionInput.value='none';emotionInput.disabled=![...emotionInput.options].some(o=>o.value!=='none'&&!o.disabled)}
 function amounts(t){const phase=t%3.8;return {blink:phase<.18?Math.sin(Math.PI*phase/.18):0,speech:speechFrame(t)}}
 function apply(b,t){
  const a=amounts(t),hasVisemes=Object.keys(b.visemes).length>0;
  if(emotionInput?.value!=='none')for(const i of b.emotions[emotionInput?.value]||[])b.mesh.morphTargetInfluences[i]=.8*(talkInput.checked&&hasVisemes? .25:1);
  if(blinkInput.checked)for(const i of b.blink)b.mesh.morphTargetInfluences[i]=a.blink;
  if(talkInput.checked){
   if(hasVisemes){for(const [group,i] of Object.entries(b.visemes))b.mesh.morphTargetInfluences[i]=a.speech.weights[group]||0;for(const i of b.talk)b.mesh.morphTargetInfluences[i]=b.base.get(i)}
   else for(const i of b.talk)b.mesh.morphTargetInfluences[i]=a.speech.jaw;
  }
 }
 function restore(type){for(const b of bindings)for(const i of b[type])b.mesh.morphTargetInfluences[i]=b.base.get(i);scene.queueRender()}
 const emotionChange=()=>{for(const b of bindings)for(const i of Object.values(b.emotions).flat())b.mesh.morphTargetInfluences[i]=b.base.get(i);scene.queueRender()};emotionInput?.addEventListener('change',emotionChange);
 const blinkChange=()=>{if(!blinkInput.checked)restore('blink')},talkChange=()=>{if(!talkInput.checked){restore('talk');for(const b of bindings)for(const i of Object.values(b.visemes))b.mesh.morphTargetInfluences[i]=b.base.get(i);wrap.dataset.faceSpeechGroup='off'}};blinkInput.addEventListener('change',blinkChange);talkInput.addEventListener('change',talkChange);
 function tick(){if(disposed)return;colorEyes();wrap.dataset.faceSpeechGroup=talkInput.checked?speechFrame(performance.now()/1000).group:'off';wrap.dataset.faceBlink=blinkInput.checked?'on':'off';wrap.dataset.faceTalk=talkInput.checked?'on':'off';wrap.dataset.faceEmotion=emotionInput?.value||'none';if(blinkInput.checked||talkInput.checked||(emotionInput&&emotionInput.value!=='none')){for(const b of bindings)apply(b,performance.now()/1000);scene.queueRender();wrap.dataset.faceBlink=blinkInput.checked?'on':'off';wrap.dataset.faceTalk=talkInput.checked?'on':'off'}frame=requestAnimationFrame(tick)}tick();
 return ()=>{disposed=true;cancelAnimationFrame(frame);for(const b of eyeBindings){b.mesh.material=b.original;if(b.masked){b.mesh.geometry=b.originalGeometry;b.copy.dispose()}for(const m of b.clones)m.dispose()}emotionInput?.removeEventListener('change',emotionChange);blinkInput.removeEventListener('change',blinkChange);talkInput.removeEventListener('change',talkChange);for(const b of bindings){b.mesh.onBeforeRender=b.before;for(const [i,v] of b.base)b.mesh.morphTargetInfluences[i]=v}};
}
