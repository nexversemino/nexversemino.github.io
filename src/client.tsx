import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {CustomCursor, CursorGlow, ScrollOrb} from './components/interactive';
import {useEffect, useRef, useState} from 'react';

// TypedTitle is the original function from cesky-drak-webove-krasy/src/routes/index.tsx.
function TypedTitle({text, delay=0}:{text:string;delay?:number}) {
  const ref=useRef<HTMLSpanElement>(null),[n,setN]=useState(0);
  useEffect(()=>{const el=ref.current;if(!el)return;let timer:ReturnType<typeof setTimeout>|undefined;
    const io=new IntersectionObserver(([e])=>{if(!e?.isIntersecting)return;io.disconnect();let i=0;
      const step=()=>{i++;setN(i);if(i<text.length)timer=setTimeout(step,55+Math.random()*90)};
      timer=setTimeout(step,delay);
    },{threshold:.4});io.observe(el);return()=>{io.disconnect();if(timer)clearTimeout(timer)};
  },[text,delay]);
  return <span ref={ref} aria-label={text}><span aria-hidden>{text.slice(0,n)}</span><span aria-hidden className={n<text.length?'blink':'blink opacity-0'}>|</span><span aria-hidden className="invisible">{text.slice(n)}</span></span>;
}

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const slot=document.getElementById('site-interactions');
if(slot&&!reduced.matches){
  const root=createRoot(slot);
  flushSync(()=>root.render(<><CustomCursor/><CursorGlow/><ScrollOrb/></>));
  slot.querySelector('.h-2')?.setAttribute('id','morfiai-cursor-ball');
  slot.querySelector('.h-10')?.setAttribute('id','morfiai-cursor-ring');
  const guide=document.getElementById('morfiai-guide-ball');
  if(guide)guide.dataset.ballInstance=crypto.randomUUID();
  reduced.addEventListener('change',()=>{root.unmount();location.reload()},{once:true});
}else reduced.addEventListener('change',()=>location.reload(),{once:true});

// Same Reveal threshold/delays and Tilt/Magnetic transforms as the original React components.
const reveal=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){
  e.target.classList.replace('translate-y-8','translate-y-0');e.target.classList.replace('opacity-0','opacity-100');reveal.unobserve(e.target);
}},{threshold:.15});
document.querySelectorAll('.transition-all.duration-700').forEach(e=>{if(!reduced.matches)reveal.observe(e)});
document.querySelectorAll<HTMLElement>('[data-typed-title]').forEach((el,i)=>{
  if(!reduced.matches)createRoot(el).render(<TypedTitle text={el.dataset.typedTitle||''} delay={(i%3)*400}/>);
});
if(!reduced.matches){
  for(const el of document.querySelectorAll<HTMLElement>('.transition-transform.duration-200')){
    const max=el.classList.contains('h-full')?4:8;
    el.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=el.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;el.style.transform=`perspective(900px) rotateY(${px*max}deg) rotateX(${-py*max}deg) scale(1.02)`});
    el.addEventListener('pointerleave',()=>{el.style.transform='perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)'});
  }
  for(const el of document.querySelectorAll<HTMLElement>('.inline-block.transition-transform.duration-300')){
    el.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=el.getBoundingClientRect();el.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.35}px, ${(e.clientY-r.top-r.height/2)*.35}px)`});
    el.addEventListener('pointerleave',()=>{el.style.transform='translate(0, 0)'});
  }
}
const menu=document.querySelector<HTMLDetailsElement>('.site-menu');
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector('summary')?.focus()}});
document.addEventListener('pointerdown',e=>{if(menu?.open&&!menu.contains(e.target as Node))menu.open=false});
document.querySelectorAll<HTMLAnchorElement>('.site-menu-links a').forEach(a=>{if(a.pathname.replace(/\/$/,'')===location.pathname.replace(/\/$/,''))a.setAttribute('aria-current','page')});
if(reduced.matches){document.querySelectorAll('video').forEach(v=>v.pause());document.querySelectorAll('model-viewer').forEach(m=>m.removeAttribute('auto-rotate'))}
