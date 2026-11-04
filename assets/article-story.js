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
