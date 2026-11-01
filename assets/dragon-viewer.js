// Existing dragon viewer, with a same-origin runtime and one uninterrupted GLB load.
const MODEL='/assets/dragon-walk-v2-9993010d.glb';
let viewerRuntime;
function runtime(){
 if(!viewerRuntime)viewerRuntime=import('/assets/vendor/model-viewer-3.5.0.min.js').catch(error=>{viewerRuntime=null;throw error});
 return viewerRuntime;
}
function buildDragonViewer(){
 const section=document.getElementById('funkce'),grid=document.querySelector('#funkce div[data-orb="cards"]');
 if(!section||!grid||document.getElementById('nex-glb-viewer'))return;
 const wrap=document.createElement('div');wrap.id='nex-glb-viewer';wrap.setAttribute('aria-label','Interaktivní 3D náhled draka');wrap.dataset.loadState='loading';
 wrap.innerHTML=`<model-viewer class="nex-glb-model" src="${MODEL}" loading="eager" reveal="auto"
 animation-name="Walk_InPlace" ${matchMedia('(prefers-reduced-motion: reduce)').matches?'':'autoplay'} alt="Animovaný 3D drak – chůze, pohyb ocasu a křídel" camera-controls ${matchMedia('(prefers-reduced-motion: reduce)').matches?'':'auto-rotate'}
 auto-rotate-delay="2500" auto-rotate-speed="0.6" interaction-prompt="none" shadow-intensity="0.5" exposure="1.15" touch-action="pan-y"></model-viewer>
 <img class="nex-glb-static" src="/assets/dragon-loop-poster.jpg" alt="Statický náhled draka při načítání 3D modelu"/>
 <span class="nex-glb-hint">⟲ otočíš tažením ${matchMedia('(pointer:coarse)').matches?'prstu':'myši'}</span>
 <div class="nex-glb-loading font-mono text-xs text-neon-cyan"><span role="status" aria-live="polite">Načítám 3D draka…</span> <button type="button" hidden>Zkusit znovu</button></div>`;
 section.insertBefore(wrap,grid);
 const model=wrap.querySelector('model-viewer'),status=wrap.querySelector('[role="status"]'),retry=wrap.querySelector('button');let retries=0;
 function error(){if(wrap.dataset.loadState==='loaded')return;wrap.dataset.loadState='error';status.textContent='3D náhled se nepodařilo načíst. Zobrazen je statický obrázek.';retry.hidden=false}
 model.addEventListener('load',()=>{wrap.dataset.loadState='loaded';wrap.classList.remove('nex-glb-fallback');wrap.classList.add('nex-glb-loaded');status.textContent='3D drak je načtený.';retry.hidden=true});
 model.addEventListener('play',()=>{wrap.dataset.animationState='playing'});
 model.addEventListener('pause',()=>{wrap.dataset.animationState='paused'});
 model.addEventListener('loop',()=>{wrap.dataset.animationLoops=String(Number(wrap.dataset.animationLoops||0)+1)});
 model.addEventListener('error',error);
 async function start(){try{await runtime();wrap.classList.add('nex-glb-live')}catch(failure){error()}}
 retry.addEventListener('click',()=>{wrap.dataset.loadState='loading';status.textContent='Načítám 3D draka…';retry.hidden=true;model.setAttribute('src',MODEL+'?retry='+(++retries));start()});
 // A slow connection is not a failed load. Never restart or abort a pending download.
 setTimeout(()=>{if(wrap.dataset.loadState==='loading')status.textContent='3D drak se stále načítá…'},30000);
 start();
}
const observer=new MutationObserver(buildDragonViewer);
function start(){observer.observe(document.body,{childList:true,subtree:true});buildDragonViewer()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
