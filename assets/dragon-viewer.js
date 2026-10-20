// Interaktivní 3D náhled draka (dragon-preview.glb) v sekci Funkce — pruh
// umístěný hned pod neonovou gradientovou linkou, do černého prostoru před kartami.
// Bez pozadí a rámečku, otáčení tažením myši. model-viewer se natáhne z CDN;
// pokud se nepovede, zůstane aspoň statická renderovaná náhledová fotka.
const GLB_SOURCES=[
 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js',
 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js'
];
const observer=new MutationObserver(buildDragonViewer);
function buildDragonViewer(){
 const funkce=document.getElementById('funkce');
 const grid=document.querySelector('#funkce div[data-orb="cards"]');
 if(!funkce||!grid||document.getElementById('nex-glb-viewer'))return;
 const wrap=document.createElement('div');
 wrap.id='nex-glb-viewer';
 wrap.setAttribute('aria-label','Interaktivní 3D náhled draka');
 wrap.innerHTML=`
  <model-viewer class="nex-glb-model"
   src="assets/dragon-preview.glb"
   poster="assets/dragon-preview-poster.png"
   alt="3D model neonového draka"
   camera-controls
   auto-rotate
   auto-rotate-delay="2500"
   auto-rotate-speed="0.6"
   interaction-prompt="none"
   shadow-intensity="0.5"
   exposure="1.15"
   touch-action="pan-y"></model-viewer>
  <img class="nex-glb-static" src="assets/dragon-preview-poster.png" alt="Neonový drak — 3D náhled"/>
  <span class="nex-glb-hint">⟲ otočíš tažením myši</span>`;
 funkce.insertBefore(wrap,grid);
 let loaded=false;
 for(const url of GLB_SOURCES){
  import(url).then(()=>{loaded=true;wrap.classList.add('nex-glb-live')}).catch(()=>{});
 }
 // Pojistka: model-viewer nespustí načítání, dokud element není viditelný
 // (a v neaktivním tabu se IntersectionObserver vůbec nespouští). Smyčka proto
 // resetuje src jen když je stránka viditelná a náhled ve viewportu; po návratu
 // do tabu se pokusy obnoví, takže se model vždy dočte a fallback zmizí.
 let kicks=0,failed=false;
 const mEl=()=>wrap.querySelector('model-viewer');
 mEl().addEventListener('load',()=>{failed=false;wrap.classList.remove('nex-glb-fallback')});
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&failed&&!mEl().loaded){failed=false;kicks=0;wrap.classList.remove('nex-glb-fallback')}
 });
 const ensureLoaded=()=>{
  const m=mEl();
  if(!m)return;
  if(m.loaded){wrap.classList.remove('nex-glb-fallback');return}
  if(document.visibilityState==='visible'&&!failed){
   const r=m.getBoundingClientRect();
   const visible=r.top<innerHeight+260&&r.bottom>-260&&r.width>60;
   if(visible){
    kicks++;
    if(kicks<=6){m.setAttribute('src','assets/dragon-preview.glb?kick='+kicks)}
    else{failed=true;wrap.classList.add('nex-glb-fallback')}
   }
  }
  setTimeout(ensureLoaded,2600);
 };
 setTimeout(ensureLoaded,2600);
}
function start(){observer.observe(document.body,{childList:true,subtree:true});buildDragonViewer()}
if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
