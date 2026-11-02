// Additive facial controls, applied after the body mixer without replacing its clip.
export function bindFace(scene,character,blinkInput,talkInput,wrap,emotionInput){
 const emotionPatterns={joy:/^(mouthSmile|happy|joy)$/i,sad:/^(mouthFrown|sad)$/i,angry:/^(browDownLeft|browDownRight|angry)$/i,cry:/^(cry|tear)$/i};
 const bindings=[];let disposed=false,frame;
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
 if(emotionInput){for(const option of emotionInput.options)if(option.value!=='none')option.disabled=!bindings.some(b=>b.emotions[option.value]?.length);if(!bindings.some(b=>b.emotions[emotionInput.value]?.length))emotionInput.value='none';emotionInput.disabled=![...emotionInput.options].some(o=>o.value!=='none'&&!o.disabled)}
 function amounts(t){const phase=t%3.8;const blink=phase<.18?Math.sin(Math.PI*phase/.18):0;const speech=Math.max(0,(Math.sin(t*13)+.45*Math.sin(t*21))*.45+.25);return {blink,speech}}
 function apply(b,t){const a=amounts(t);if(emotionInput?.value!=='none')for(const i of b.emotions[emotionInput?.value]||[])b.mesh.morphTargetInfluences[i]=.8;if(blinkInput.checked)for(const i of b.blink)b.mesh.morphTargetInfluences[i]=a.blink;if(talkInput.checked)for(const i of b.talk)b.mesh.morphTargetInfluences[i]=a.speech}
 function restore(type){for(const b of bindings)for(const i of b[type])b.mesh.morphTargetInfluences[i]=b.base.get(i);scene.queueRender()}
 const emotionChange=()=>{for(const b of bindings)for(const i of Object.values(b.emotions).flat())b.mesh.morphTargetInfluences[i]=b.base.get(i);scene.queueRender()};emotionInput?.addEventListener('change',emotionChange);
 const blinkChange=()=>{if(!blinkInput.checked)restore('blink')},talkChange=()=>{if(!talkInput.checked)restore('talk')};blinkInput.addEventListener('change',blinkChange);talkInput.addEventListener('change',talkChange);
 function tick(){if(disposed)return;wrap.dataset.faceBlink=blinkInput.checked?'on':'off';wrap.dataset.faceTalk=talkInput.checked?'on':'off';wrap.dataset.faceEmotion=emotionInput?.value||'none';if(blinkInput.checked||talkInput.checked||(emotionInput&&emotionInput.value!=='none')){for(const b of bindings)apply(b,performance.now()/1000);scene.queueRender();wrap.dataset.faceBlink=blinkInput.checked?'on':'off';wrap.dataset.faceTalk=talkInput.checked?'on':'off'}frame=requestAnimationFrame(tick)}tick();
 return ()=>{disposed=true;cancelAnimationFrame(frame);emotionInput?.removeEventListener('change',emotionChange);blinkInput.removeEventListener('change',blinkChange);talkInput.removeEventListener('change',talkChange);for(const b of bindings){b.mesh.onBeforeRender=b.before;for(const [i,v] of b.base)b.mesh.morphTargetInfluences[i]=v}};
}
