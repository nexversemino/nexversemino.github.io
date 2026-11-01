// Existing dragon viewer, with a same-origin runtime and one uninterrupted GLB load.
const MODEL='/assets/laya-complete-670.glb';
let viewerRuntime;
function runtime(){
 if(!viewerRuntime)viewerRuntime=import('/assets/vendor/model-viewer-3.5.0.min.js').catch(error=>{viewerRuntime=null;throw error});
 return viewerRuntime;
}
function buildDragonViewer(){
 const section=document.getElementById('funkce'),grid=document.querySelector('#funkce div[data-orb="cards"]');
 if(!section||!grid||document.getElementById('nex-glb-viewer'))return;
 const wrap=document.createElement('div');wrap.id='nex-glb-viewer';wrap.setAttribute('aria-label','Laya – interaktivní ukázka animací');wrap.dataset.loadState='loading';
 wrap.innerHTML=`<model-viewer class="nex-glb-model" src="${MODEL}" loading="eager" reveal="auto"
  ${matchMedia('(prefers-reduced-motion: reduce)').matches?'':'autoplay'} alt="Růžový robot Laya – ukázka animací" camera-controls ${matchMedia('(prefers-reduced-motion: reduce)').matches?'':'auto-rotate'}
 auto-rotate-delay="2500" auto-rotate-speed="0.6" interaction-prompt="none" shadow-intensity="0.5" exposure="1.15" touch-action="pan-y"></model-viewer>
 
 <span class="nex-glb-hint">← → animace · ⟲ otočíš tažením ${matchMedia('(pointer:coarse)').matches?'prstu':'myši'}</span>
 <div class="nex-glb-loading font-mono text-xs text-neon-cyan"><span role="status" aria-live="polite">Načítám Layu…</span> <button type="button" hidden>Zkusit znovu</button></div>`;
 section.insertBefore(wrap,grid);
 const controls=document.createElement('div');controls.className='nex-animation-controls';
 controls.innerHTML='<button type="button" aria-label="Předchozí animace">←</button><label>Animace <select aria-label="Animace Laya"></select></label><button type="button" aria-label="Další animace">→</button><button type="button" aria-label="Pozastavit animaci">Ⅱ</button><span class="nex-animation-count" aria-live="polite"></span>';
 wrap.appendChild(controls);
 const select=controls.querySelector('select'),buttons=controls.querySelectorAll('button'),counter=controls.querySelector('.nex-animation-count');let clips=[],index=0;
 function choose(next){if(!clips.length)return;index=(next+clips.length)%clips.length;model.animationName=clips[index];select.value=String(index);counter.textContent=`${index+1} / ${clips.length}`;model.play();buttons[2].textContent='Ⅱ';buttons[2].setAttribute('aria-label','Pozastavit animaci');wrap.dataset.animationName=clips[index]}
 buttons[0].addEventListener('click',()=>choose(index-1));buttons[1].addEventListener('click',()=>choose(index+1));select.addEventListener('change',()=>choose(Number(select.value)));
 buttons[2].addEventListener('click',()=>{if(model.paused){model.play();buttons[2].textContent='Ⅱ';buttons[2].setAttribute('aria-label','Pozastavit animaci')}else{model.pause();buttons[2].textContent='▶';buttons[2].setAttribute('aria-label','Přehrát animaci')}});
 wrap.tabIndex=0;
 wrap.addEventListener('keydown',event=>{if(event.target.closest('select,input,textarea'))return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();choose(index+(event.key==='ArrowRight'?1:-1))}});
 const model=wrap.querySelector('model-viewer'),status=wrap.querySelector('[role="status"]'),retry=wrap.querySelector('button');let retries=0;
 function error(){if(wrap.dataset.loadState==='loaded')return;wrap.dataset.loadState='error';status.textContent='3D náhled se nepodařilo načíst. Zkus jej načíst znovu.';retry.hidden=false}
 model.addEventListener('load',()=>{wrap.dataset.loadState='loaded';wrap.classList.remove('nex-glb-fallback');wrap.classList.add('nex-glb-loaded');status.textContent='Laya je načtená.';retry.hidden=true;clips=model.availableAnimations;select.replaceChildren(...clips.map((name,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=name;return option}));if(clips.length){index=Math.max(0,clips.findIndex(name=>/^idle$/i.test(name)));model.animationName=clips[index];select.value=String(index);counter.textContent=`${index+1} / ${clips.length}`;wrap.dataset.animationName=clips[index];if(!matchMedia('(prefers-reduced-motion: reduce)').matches)model.play()}});
 model.addEventListener('play',()=>{wrap.dataset.animationState='playing'});
 model.addEventListener('pause',()=>{wrap.dataset.animationState='paused'});
 model.addEventListener('loop',()=>{wrap.dataset.animationLoops=String(Number(wrap.dataset.animationLoops||0)+1)});
 model.addEventListener('error',error);
 async function start(){try{await runtime();wrap.classList.add('nex-glb-live')}catch(failure){error()}}
 retry.addEventListener('click',()=>{wrap.dataset.loadState='loading';status.textContent='Načítám Layu…';retry.hidden=true;model.setAttribute('src',MODEL+'?retry='+(++retries));start()});
 // A slow connection is not a failed load. Never restart or abort a pending download.
 setTimeout(()=>{if(wrap.dataset.loadState==='loading')status.textContent='Laya se stále načítá…'},30000);
 start();
}
const observer=new MutationObserver(buildDragonViewer);
function start(){observer.observe(document.body,{childList:true,subtree:true});buildDragonViewer()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
