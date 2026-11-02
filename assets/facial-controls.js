// Additive facial controls, applied after the body mixer without replacing its clip.
export function bindFace(scene,character,blinkInput,talkInput,wrap,emotionInput,angerEyeNames=[]){
 const emotionPatterns={joy:/^(mouthSmile|happy|joy)$/i,sad:/^(mouthFrown|sad)$/i,angry:/^(browDownLeft|browDownRight|angry)$/i,cry:/^(cry|tear)$/i};
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
  const emotions=Object.fromEntries(Object.entries(emotionPatterns).map(([kind,pattern])=>[kind,Object.keys(d).filter(n=>pattern.test(n)).map(n=>d[n])]));
  if(!blink.length&&!talk.length&&!Object.values(emotions).some(a=>a.length))return;
  const indices=[...new Set([...blink.map(n=>d[n]),...talk.map(n=>d[n]),...Object.values(emotions).flat()])];const base=new Map(indices.map(i=>[i,w[i]]));const before=mesh.onBeforeRender;
  const b={mesh,blink:blink.map(n=>d[n]),talk:talk.map(n=>d[n]),emotions,base,before};bindings.push(b);
  mesh.onBeforeRender=function(...args){before?.apply(this,args);apply(b,performance.now()/1000)};
 });
 const blinkCount=bindings.reduce((n,b)=>n+b.blink.length,0),talkCount=bindings.reduce((n,b)=>n+b.talk.length,0);
 blinkInput.disabled=!blinkCount;talkInput.disabled=!talkCount;wrap.dataset.faceBlinkTargets=String(blinkCount);wrap.dataset.faceTalkTargets=String(talkCount);
 if(emotionInput){for(const option of emotionInput.options)if(option.value!=='none')option.disabled=!(bindings.some(b=>b.emotions[option.value]?.length)||(option.value==='angry'&&eyeBindings.length));if(!(bindings.some(b=>b.emotions[emotionInput.value]?.length)||(emotionInput.value==='angry'&&eyeBindings.length)))emotionInput.value='none';emotionInput.disabled=![...emotionInput.options].some(o=>o.value!=='none'&&!o.disabled)}
 function amounts(t){const phase=t%3.8;const blink=phase<.18?Math.sin(Math.PI*phase/.18):0;const speech=Math.max(0,(Math.sin(t*13)+.45*Math.sin(t*21))*.45+.25);return {blink,speech}}
 function apply(b,t){const a=amounts(t);if(emotionInput?.value!=='none')for(const i of b.emotions[emotionInput?.value]||[])b.mesh.morphTargetInfluences[i]=.8;if(blinkInput.checked)for(const i of b.blink)b.mesh.morphTargetInfluences[i]=a.blink;if(talkInput.checked)for(const i of b.talk)b.mesh.morphTargetInfluences[i]=a.speech}
 function restore(type){for(const b of bindings)for(const i of b[type])b.mesh.morphTargetInfluences[i]=b.base.get(i);scene.queueRender()}
 const emotionChange=()=>{for(const b of bindings)for(const i of Object.values(b.emotions).flat())b.mesh.morphTargetInfluences[i]=b.base.get(i);scene.queueRender()};emotionInput?.addEventListener('change',emotionChange);
 const blinkChange=()=>{if(!blinkInput.checked)restore('blink')},talkChange=()=>{if(!talkInput.checked)restore('talk')};blinkInput.addEventListener('change',blinkChange);talkInput.addEventListener('change',talkChange);
 function tick(){if(disposed)return;colorEyes();wrap.dataset.faceBlink=blinkInput.checked?'on':'off';wrap.dataset.faceTalk=talkInput.checked?'on':'off';wrap.dataset.faceEmotion=emotionInput?.value||'none';if(blinkInput.checked||talkInput.checked||(emotionInput&&emotionInput.value!=='none')){for(const b of bindings)apply(b,performance.now()/1000);scene.queueRender();wrap.dataset.faceBlink=blinkInput.checked?'on':'off';wrap.dataset.faceTalk=talkInput.checked?'on':'off'}frame=requestAnimationFrame(tick)}tick();
 return ()=>{disposed=true;cancelAnimationFrame(frame);for(const b of eyeBindings){b.mesh.material=b.original;if(b.masked){b.mesh.geometry=b.originalGeometry;b.copy.dispose()}for(const m of b.clones)m.dispose()}emotionInput?.removeEventListener('change',emotionChange);blinkInput.removeEventListener('change',blinkChange);talkInput.removeEventListener('change',talkChange);for(const b of bindings){b.mesh.onBeforeRender=b.before;for(const [i,v] of b.base)b.mesh.morphTargetInfluences[i]=v}};
}
