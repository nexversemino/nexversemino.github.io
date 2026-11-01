import {attachDownloads} from './animation-downloads.js?v=1';
import {bindFace} from './facial-controls.js?v=1';
import {characters,labels} from './character-data.js?v=2';
let viewerRuntime;
function runtime(){
 if(!viewerRuntime)viewerRuntime=import('/assets/vendor/model-viewer-3.5.0.min.js?face=1').catch(error=>{viewerRuntime=null;throw error});
 return viewerRuntime;
}
function buildDragonViewer(){
 const section=document.getElementById('funkce'),grid=document.querySelector('#funkce div[data-orb="cards"]');
 if(!section||!grid||document.getElementById('nex-glb-viewer'))return;
 const wrap=document.createElement('div');wrap.id='nex-glb-viewer';wrap.tabIndex=0;wrap.setAttribute('aria-label','Ukázka postav a animací');
 wrap.innerHTML='<div class="nex-character-picker"><label>Postava <select aria-label="Postava v náhledu"></select></label></div><div class="nex-model-slot"></div><span class="nex-glb-hint">← → animace · model otočíš tažením</span><div class="nex-glb-loading font-mono text-xs text-neon-cyan"><span role="status" aria-live="polite">Načítám postavu…</span> <button type="button" hidden>Zkusit znovu</button></div><div class="nex-face-controls"><label><input type="checkbox" aria-label="Mrkání"> <span data-blink-label>Mrkání</span></label><label><input type="checkbox" aria-label="Mluva"> Mluva</label></div><div class="nex-animation-controls"><button type="button" aria-label="Předchozí animace">←</button><label>Animace <select aria-label="Animace postavy"></select></label><button type="button" aria-label="Další animace">→</button><button type="button" aria-label="Pozastavit animaci">Ⅱ</button><span class="nex-animation-count" aria-live="polite"></span></div>';
 section.insertBefore(wrap,grid);
 const picker=wrap.querySelector('[aria-label="Postava v náhledu"]'),select=wrap.querySelector('[aria-label="Animace postavy"]'),controls=wrap.querySelector('.nex-animation-controls'),buttons=controls.querySelectorAll('button'),counter=wrap.querySelector('.nex-animation-count'),slot=wrap.querySelector('.nex-model-slot'),status=wrap.querySelector('[role="status"]'),retry=wrap.querySelector('.nex-glb-loading button');
 const blinkInput=wrap.querySelector('[aria-label="Mrkání"]'),talkInput=wrap.querySelector('[aria-label="Mluva"]');let disposeFace=()=>{};
 let model,character=characters[0],clips=[],index=0,generation=0;
 const downloads=attachDownloads(wrap,characters,()=>character,()=>clips[index],name=>{const i=clips.indexOf(name);if(i>=0)choose(i)});downloads.setLabels(labels);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o}
 picker.replaceChildren(...characters.map(c=>option(c.id,c.label)));
 function pauseLabel(paused){buttons[2].textContent=paused?'▶':'Ⅱ';buttons[2].setAttribute('aria-label',paused?'Přehrát animaci':'Pozastavit animaci')}
 function enabled(value){select.disabled=!value;buttons.forEach(b=>b.disabled=!value)}
 function choose(next,play=true){if(!clips.length)return;index=(next+clips.length)%clips.length;model.animationName=clips[index];select.value=String(index);counter.textContent=`${index+1} / ${clips.length}`;wrap.dataset.animationName=clips[index];if(play)model.play();else model.pause();pauseLabel(!play);downloads.update()}
 async function loadCharacter(c){
  disposeFace();blinkInput.disabled=true;talkInput.disabled=true;wrap.querySelector('[data-blink-label]').textContent=c.id==='robot-b'?'Mrkání šesti očí':'Mrkání';character=c;const current=++generation;clips=[];enabled(false);counter.textContent='';select.replaceChildren();wrap.dataset.loadState='loading';wrap.dataset.character=c.id;wrap.dataset.animationState='loading';delete wrap.dataset.animationName;downloads.update();wrap.classList.remove('nex-glb-loaded');status.textContent=`Načítám: ${c.label}…`;retry.hidden=true;
  if(model)model.pause();slot.replaceChildren();
  try{
   const viewerAPI=await runtime();if(current!==generation)return;
   model=document.createElement('model-viewer');const active=model;
   model.className='nex-glb-model';model.setAttribute('alt',c.label+' – ukázka animací');model.setAttribute('camera-controls','');model.setAttribute('camera-orbit',(c.id==='holographic'||c.id==='amethyst'||c.id==='rose')?'180deg 75deg auto':'0deg 75deg auto');model.setAttribute('loading','eager');model.setAttribute('reveal','auto');model.setAttribute('interaction-prompt','none');model.setAttribute('touch-action','pan-y');model.setAttribute('shadow-intensity','0.5');model.setAttribute('exposure','1.15');
   model.addEventListener('load',()=>{if(current!==generation)return;clips=active.availableAnimations;select.replaceChildren(...clips.map((name,i)=>option(String(i),labels[name]||'Animace '+(i+1))));enabled(clips.length>0);wrap.dataset.loadState='loaded';wrap.classList.add('nex-glb-loaded');status.textContent=c.label+' je načtený.';retry.hidden=true;disposeFace=bindFace(viewerAPI.getFacialScene(active),c.id,blinkInput,talkInput,wrap);choose(Math.max(0,clips.findIndex(n=>/^(idle|idle_loop|Original_idle_loop)$/i.test(n))),!reduced)});
   model.addEventListener('error',()=>{if(current===generation)error()});
   model.addEventListener('play',()=>{if(current===generation)wrap.dataset.animationState='playing'});model.addEventListener('pause',()=>{if(current===generation)wrap.dataset.animationState='paused'});
   model.addEventListener('loop',()=>{if(current===generation)wrap.dataset.animationLoops=String(Number(wrap.dataset.animationLoops||0)+1)});
   model.setAttribute('src',c.src);slot.appendChild(model);wrap.classList.add('nex-glb-live');
  }catch(failure){if(current===generation)error()}
 }
 function error(){wrap.dataset.loadState='error';status.textContent='Postavu se nepodařilo načíst. Zkus ji načíst znovu.';retry.hidden=false;enabled(false)}
 picker.addEventListener('change',()=>loadCharacter(characters.find(c=>c.id===picker.value)||characters[0]));
 buttons[0].addEventListener('click',()=>choose(index-1));buttons[1].addEventListener('click',()=>choose(index+1));select.addEventListener('change',()=>choose(Number(select.value)));
 buttons[2].addEventListener('click',()=>{if(!model||!clips.length)return;if(model.paused){model.play();pauseLabel(false)}else{model.pause();pauseLabel(true)}});
 wrap.addEventListener('keydown',event=>{if(event.target.closest('select,input,textarea'))return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();choose(index+(event.key==='ArrowRight'?1:-1))}},true);
 retry.addEventListener('click',()=>loadCharacter(character));
 loadCharacter(character);
}
const observer=new MutationObserver(buildDragonViewer);
function start(){observer.observe(document.body,{childList:true,subtree:true});buildDragonViewer()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
