const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function updateHero(){
 const hero=document.querySelector('.nex-dragon-video-section');if(!hero)return;
 const heading=hero.querySelector('h1');if(!heading||heading.dataset.morfiaiCopy)return;
 heading.dataset.morfiaiCopy='true';heading.className='morfiai-hero-title';heading.setAttribute('aria-label','Tvoř světy. Dej jim život.');heading.replaceChildren();
 for(const [index,text] of ['Tvoř světy.','Dej jim život.'].entries()){
  const line=document.createElement('span');line.className='morfiai-title-line'+(index?' morfiai-title-accent':'');line.setAttribute('aria-hidden','true');
  for(const letter of text){const span=document.createElement('span');span.className='morfiai-title-char';span.textContent=letter===' '?'\u00a0':letter;line.append(span)}heading.append(line);
 }
 const chars=[...heading.querySelectorAll('.morfiai-title-char')];
 const GRAD_CYCLE=6000;
 const accent=heading.querySelector('.morfiai-title-accent');
 const accentChars=accent?[...accent.children]:[];
 // One continuous neon-gradient band: every letter paints its own slice of the same
 // line-wide gradient, so the colours run unbroken from D to t exactly like the
 // site's .text-neon-gradient, and the letters stay solid (no wash-out on the dark hero).
 let gradTile=0,gradBases=[],gradOnScreen=true;
 function paintGradient(time){
   if(!gradTile||!accentChars.length)return;
   const shift=reduced.matches?0:((time%GRAD_CYCLE)/GRAD_CYCLE)*gradTile;
   for(let i=0;i<accentChars.length;i++)accentChars[i].style.backgroundPosition=`${(-gradBases[i]-shift).toFixed(2)}px 0`;
 }
 function alignGradient(){
   if(!accent||!accentChars.length)return;
   const line=accent.getBoundingClientRect();if(!line.width)return;
   gradTile=line.width*2;
   gradBases=accentChars.map(char=>{const box=char.getBoundingClientRect();return box.left-line.left;});
   for(const char of accentChars)char.style.backgroundSize=`${gradTile}px 100%`;
   paintGradient(performance.now());
 }
 requestAnimationFrame(alignGradient);document.fonts?.ready.then(alignGradient);window.addEventListener('resize',alignGradient);
 if(!reduced.matches&&accent){
   try{new IntersectionObserver(entries=>{gradOnScreen=!!entries[0]?.isIntersecting},{rootMargin:'100px'}).observe(accent)}catch(error){}
   const gradLoop=time=>{if(gradOnScreen&&!document.hidden)paintGradient(time);requestAnimationFrame(gradLoop)};
   requestAnimationFrame(gradLoop);
 }
 heading.addEventListener('pointermove',event=>{if(reduced.matches)return;for(const char of chars){const box=char.getBoundingClientRect(),distance=Math.hypot(event.clientX-box.left-box.width/2,event.clientY-box.top-box.height/2),strength=Math.max(0,1-distance/125);char.style.transform=`translateY(${-10*strength}px) rotate(${(event.clientX-box.left-box.width/2)*strength*.1}deg)`;char.style.filter=`brightness(${1+strength*.6})`;}});
 heading.addEventListener('pointerleave',()=>{for(const char of chars){char.style.transform='';char.style.filter=''}});
 const description=heading.nextElementSibling;if(description?.tagName==='P'){description.textContent='Postavy, pohyb, hudba i dialogy. Proměň svoje nápady v herní světy pomocí AI.';description.classList.add('morfiai-hero-description')}
}
new MutationObserver(updateHero).observe(document.body,{childList:true,subtree:true});updateHero();
