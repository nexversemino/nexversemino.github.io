// MORFIAI – doprovod článku: indikátor čtení a přehled kapitol.
// Článek je čitelný i bez tohoto skriptu; jde jen o doprovodné animace.
const section=document.getElementById('pribeh');
if(section){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const heads=Array.from(section.querySelectorAll('h2[id^="pribeh-"]'));
 const bar=document.createElement('div');
 bar.className='article-progress';
 bar.setAttribute('aria-hidden','true');
 const fill=document.createElement('span');
 fill.className='article-progress-fill';
 bar.appendChild(fill);
 document.body.appendChild(bar);
 let nav=null;
 const links=[];
 if(heads.length){
  nav=document.createElement('nav');
  nav.className='article-chapters';
  nav.setAttribute('aria-label','Kapitoly článku');
  for(const head of heads){
   const link=document.createElement('a');
   link.href='#'+head.id;
   const dot=document.createElement('span');
   dot.className='article-dot';
   const label=document.createElement('span');
   label.className='article-chapter-label';
   label.textContent=(head.dataset.chapter||'').trim();
   link.append(dot,label);
   link.addEventListener('click',event=>{
    event.preventDefault();
    head.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
   });
   nav.appendChild(link);
   links.push(link);
  }
  document.body.appendChild(nav);
 }
 let queued=false;
 function update(){
  queued=false;
  const rect=section.getBoundingClientRect();
  const viewport=window.innerHeight;
  const span=rect.height-viewport;
  const progress=span>0?Math.min(1,Math.max(0,-rect.top/span)):(rect.top<=0?1:0);
  fill.style.transform='scaleX('+progress.toFixed(4)+')';
  const visible=rect.top<viewport&&rect.bottom>0;
  bar.classList.toggle('is-visible',visible);
  if(nav)nav.classList.toggle('is-visible',visible);
  if(links.length){
   const marker=viewport*0.35;
   let active=-1;
   for(let i=0;i<heads.length;i++){
    if(heads[i].getBoundingClientRect().top<=marker)active=i;
   }
   for(let i=0;i<links.length;i++){
    links[i].classList.toggle('is-active',i===active);
    if(i===active)links[i].setAttribute('aria-current','location');
    else links[i].removeAttribute('aria-current');
   }
  }
 }
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(update);}};
 addEventListener('scroll',schedule,{passive:true});
 addEventListener('resize',schedule,{passive:true});
 addEventListener('load',schedule,{once:true});
 update();
}

const articlePointerArea = document.querySelector('#pribeh');
if (articlePointerArea) {
  const pointer = document.createElement('div');
  pointer.className = 'article-prism-cursor';
  pointer.setAttribute('aria-hidden', 'true');
  pointer.innerHTML = '<svg viewBox="0 0 22 28"><path d="M2 2 19 15l-8 1-4 8Z" fill="#111420" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m2 2 9 14" stroke="currentColor" stroke-width="1.4"/></svg>';
  document.body.append(pointer);

  const mode = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  let position = null;
  function syncArticlePointer() {
    const target = position && document.elementFromPoint(...position);
    const active = mode.matches && target && articlePointerArea.contains(target);
    document.documentElement.classList.toggle('article-pointer-active', Boolean(active));
    if (active) pointer.style.transform = 'translate(' + (position[0] - 2) + 'px,' + (position[1] - 2) + 'px)';
  }
  function clearArticlePointer() {
    position = null;
    syncArticlePointer();
  }
  addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') { clearArticlePointer(); return; }
    position = [event.clientX, event.clientY];
    syncArticlePointer();
  }, { passive: true });
  addEventListener('scroll', syncArticlePointer, { passive: true });
  addEventListener('resize', syncArticlePointer);
  addEventListener('blur', clearArticlePointer);
  document.addEventListener('pointerleave', clearArticlePointer);
  mode.addEventListener('change', syncArticlePointer);
}
