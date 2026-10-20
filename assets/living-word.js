import {segmentBoxHit,tacticalIntent} from './combat-logic.js';
// Morfiai mini arena: same fine-line stickmen as the local NexVerse NeonBattle.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function mountArena(){
 const word=document.querySelector('#engine h2 em'),engine=document.querySelector('#engine'),contact=document.querySelector('#kontakt');
 if(!word||!engine||!contact||word.dataset.morfiaiArena)return;word.dataset.morfiaiArena='true';word.removeAttribute('data-orb');
 document.querySelectorAll('.morfiai-living-word,.morfiai-guide-target').forEach(el=>{if(el.tagName==='CANVAS')el.remove();else el.classList.remove('morfiai-guide-target')});
 const canvas=document.createElement('canvas');canvas.className='morfiai-living-word morfiai-arena';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);const ctx=canvas.getContext('2d');
 const ui=document.createElement('div');ui.className='morfiai-battle-ui';ui.hidden=true;
 const status=document.createElement('span'),pause=document.createElement('button'),restart=document.createElement('button');pause.textContent='Pauza';restart.textContent='Znovu';pause.type=restart.type='button';ui.append(status,pause,restart);document.body.append(ui);
 const palette=['#49e2ff','#ff48b0','#b27aff','#ffad32','#fff06a','#46c9ef'];
 let fighters=[],bullets=[],sparks=[],particles=[],source,elapsed=0,last=0,started=false,paused=false,round=1,wins=0,roundEnd=0,shots=0,hits=0,spawnAge=0,championColor=null,playerChampion=false,covers=[],coverAt=-1,dodges=0,coverBlocks=0,peakHidden=0,finalDuel=false;
 const player={x:0,y:0,active:false,cool:0,hp:100,respawn:0,color:'#6bff60',phase:0,clientX:innerWidth/2,clientY:innerHeight/2,id:-1,champion:false,invulnerable:0};
 const random=(a,b)=>a+Math.random()*(b-a),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)},lerp=(a,b,t)=>a+(b-a)*t;
 const box=el=>{const b=el.getBoundingClientRect();return {x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height}};
 function bounds(){const a=box(engine),b=box(contact);return {left:25,right:innerWidth-25,top:a.y+55,bottom:b.y+b.h-35}}
 function shown(){const a=engine.getBoundingClientRect(),b=contact.getBoundingClientRect();return a.top<innerHeight&&b.bottom>90}
 function resize(){const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=innerWidth*ratio;canvas.height=innerHeight*ratio;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(ratio,0,0,ratio,0,0)}
 resize();addEventListener('resize',resize);
 function refreshCovers(){
  covers=[];for(const heading of document.querySelectorAll('#engine h2,#kontakt h2')){const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){for(let i=0;i<node.textContent.length;i++){if(!node.textContent[i].trim())continue;const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);const b=range.getBoundingClientRect();if(b.width>6&&b.height>24)covers.push({x:b.left+scrollX+2,y:b.top+scrollY+5,w:Math.max(5,b.width-4),h:Math.max(20,b.height-10),letter:node.textContent[i]})}}}
 }
 function newRound(winner){
  const area=bounds();championColor=winner||null;playerChampion=winner===player.color;player.champion=playerChampion;
  const colors=winner&&winner!==player.color?[winner,...palette.filter(c=>c!==winner)]:palette;
  fighters=colors.map((color,i)=>({id:i,color,champion:color===championColor,x:lerp(area.left+20,area.right-20,i/5),y:area.top+90+(i%3)*Math.min(125,(area.bottom-area.top-150)/3),hp:100,cool:random(.7,2),phase:random(0,6),hit:0,state:'flanking',stateTime:random(1,3),coverCooldown:0,coverCycles:0}));
  bullets=[];sparks=[];roundEnd=0;spawnAge=0;finalDuel=false;sampleWord();refreshCovers();player.hp=100;player.respawn=0;player.invulnerable=1;
  canvas.dataset.spawnRound=String(round);canvas.dataset.champion=championColor||'';
 }
 function sampleWord(){source=box(word);const t=document.createElement('canvas');t.width=Math.max(1,Math.ceil(source.w));t.height=Math.max(1,Math.ceil(source.h));const c=t.getContext('2d'),style=getComputedStyle(word);c.font=style.font||`italic ${style.fontSize} ${style.fontFamily}`;c.textBaseline='middle';c.fillStyle='white';c.fillText(word.textContent,0,t.height*.47);const image=c.getImageData(0,0,t.width,t.height).data;particles=[];for(let y=0;y<t.height;y+=3)for(let x=0;x<t.width;x+=3)if(image[(y*t.width+x)*4+3]>80)particles.push({x:source.x+x,y:source.y+y,seed:particles.length*2.39996})}
 function silhouette(f,time){const w=Math.sin(time*6+f.phase)*4;return {head:{x:f.x,y:f.y-26},segments:[[{x:f.x,y:f.y-21},{x:f.x,y:f.y-7}],[{x:f.x,y:f.y-17},{x:f.x-9,y:f.y-11+w*.3}],[{x:f.x,y:f.y-17},{x:f.x+11,y:f.y-17}],[{x:f.x,y:f.y-7},{x:f.x-7+w,y:f.y+4}],[{x:f.x,y:f.y-7},{x:f.x+7-w,y:f.y+4}]]}}
 function stick(f,time,isPlayer=false,alpha=1){
  const hidden=f.state==='hidden';const shape=silhouette(f,hidden?0:time);ctx.globalAlpha=hidden?alpha*.18:alpha;ctx.strokeStyle=f.hit>0?'#fff':f.color;ctx.lineWidth=isPlayer?1.9:1.35;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowBlur=f.champion?12:isPlayer?4:2;ctx.shadowColor=f.color;
  if(f.champion){ctx.save();ctx.globalAlpha=alpha*.14;ctx.fillStyle=f.color;ctx.beginPath();ctx.ellipse(f.x-scrollX,f.y-scrollY-15,19,27,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  if(!hidden){ctx.beginPath();ctx.arc(shape.head.x-scrollX,shape.head.y-scrollY,5,0,Math.PI*2);for(const seg of shape.segments){ctx.moveTo(seg[0].x-scrollX,seg[0].y-scrollY);ctx.lineTo(seg[1].x-scrollX,seg[1].y-scrollY)}ctx.stroke()}
  ctx.shadowBlur=0;ctx.globalAlpha=alpha;
  if(f.champion){const x=f.x-scrollX,y=f.y-scrollY-36;ctx.strokeStyle='#ffe27b';ctx.fillStyle='#8b641f88';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x-9,y-9);ctx.lineTo(x-3,y-5);ctx.lineTo(x,y-12);ctx.lineTo(x+3,y-5);ctx.lineTo(x+9,y-9);ctx.lineTo(x+7,y);ctx.closePath();ctx.fill();ctx.stroke()}
  const healthY=f.y-scrollY-(f.champion?58:43),x=f.x-scrollX-15;ctx.fillStyle='#030809e8';ctx.fillRect(x-1,healthY-1,32,6);ctx.strokeStyle=f.color;ctx.globalAlpha=.5;ctx.lineWidth=.7;ctx.strokeRect(x-1,healthY-1,32,6);ctx.globalAlpha=alpha;ctx.fillStyle=f.hp<30?'#ff526a':f.color;ctx.fillRect(x,healthY,30*clamp(f.hp,0,100)/100,4);
  ctx.font='7px monospace';ctx.textAlign='center';ctx.fillStyle='#d3e6e9';ctx.fillText(String(Math.ceil(f.hp)),f.x-scrollX,healthY-3);ctx.globalAlpha=1;
 }
 function cloud(){const targets=[];for(const f of fighters){const s=silhouette(f,0);for(let i=0;i<14;i++){const a=i/14*Math.PI*2;targets.push({x:s.head.x+5*Math.cos(a),y:s.head.y+5*Math.sin(a),color:f.color})}for(const seg of s.segments)for(let i=0;i<8;i++)targets.push({x:lerp(seg[0].x,seg[1].x,i/7),y:lerp(seg[0].y,seg[1].y,i/7),color:f.color})}return targets}
 function gameMode(){return started&&elapsed>3.8&&!reduced.matches}
 function interactive(target){return target instanceof Element&&!!target.closest('a,button,input,select,textarea,[contenteditable="true"],.morfiai-battle-ui')}
 function eligible(event){return gameMode()&&!paused&&event.pointerType!=='touch'&&!interactive(event.target)}
 function hidePlayer(){player.active=false;document.documentElement.classList.remove('morfiai-arena-pointer')}
 function move(event){if(event.pointerType==='touch')return;player.active=gameMode();document.documentElement.classList.toggle('morfiai-arena-pointer',player.active);document.documentElement.classList.toggle('morfiai-game-on',gameMode());player.clientX=event.clientX;player.clientY=event.clientY;player.x=event.clientX+scrollX;player.y=event.clientY+scrollY+18}
 function shoot(from,target,id,color){if(bullets.length>70)return;const side=target.x<from.x?-1:1,origin={x:from.x+side*12,y:from.y-17};const distance=Math.hypot(target.x-origin.x,target.y-15-origin.y),lead=Math.min(.45,distance/360);const dx=target.x+(target.vx||0)*lead-origin.x,dy=target.y-15+(target.vy||0)*lead-origin.y,d=Math.hypot(dx,dy)||1;bullets.push({...origin,vx:dx/d*360,vy:dy/d*360,id,color,life:3.5})}
 function click(event){
  if(gameMode()&&!interactive(event.target)&&event.pointerType!=='touch')event.preventDefault();
  if(!eligible(event)||player.cool>0||player.hp<=0)return;player.clientX=event.clientX;player.clientY=event.clientY;player.x=event.clientX+scrollX;player.y=event.clientY+scrollY+18;player.active=true;
  const enemy=fighters.filter(f=>f.hp>0).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];if(enemy){shoot(player,enemy,-1,player.color);shots++;player.cool=.2;canvas.dataset.playerShots=String(shots)}
 }
 addEventListener('pointermove',move,{passive:true});addEventListener('pointerdown',click,{passive:false});addEventListener('blur',hidePlayer);document.addEventListener('pointerleave',hidePlayer);
 addEventListener('scroll',()=>{if(player.active){player.x=player.clientX+scrollX;player.y=player.clientY+scrollY+18}},{passive:true});
 document.addEventListener('selectstart',event=>{if(gameMode()&&!interactive(event.target))event.preventDefault()});
 pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Pokračovat':'Pauza'});
 restart.addEventListener('click',()=>{elapsed=0;round=1;wins=hits=shots=0;started=true;sampleWord();newRound();paused=false;pause.textContent='Pauza';word.style.opacity=''});
 function frame(now){if(!canvas.isConnected){ui.remove();hidePlayer();return}requestAnimationFrame(frame);const dt=last?Math.min((now-last)/1000,.04):0;last=now;ctx.clearRect(0,0,innerWidth,innerHeight);const visible=shown();ui.hidden=!started||reduced.matches;document.documentElement.classList.toggle('morfiai-game-on',gameMode());
  if(document.hidden||reduced.matches){hidePlayer();word.style.opacity='';document.documentElement.classList.remove('morfiai-game-on');return}if(!visible&&started){if(player.active)stick(player,elapsed,true);return}
  if(!started){const rect=word.getBoundingClientRect();if(rect.top>innerHeight*.85||rect.bottom<90)return;started=true;sampleWord();newRound()}
  if(paused){fighters.filter(f=>f.hp>0).forEach(f=>stick(f,elapsed));if(player.active)stick(player,elapsed,true);return}
  elapsed+=dt;spawnAge+=dt;canvas.dataset.phase=spawnAge<1.2?'word':spawnAge<3.8?'assembling':'battle';canvas.dataset.round=String(round);
  if(spawnAge<1.2){word.style.opacity='';if(player.active)stick(player,elapsed,true);return}
  if(spawnAge<3.8){const u=(spawnAge-1.2)/2.6,targets=cloud();word.style.opacity=String(1-ease(u*2));particles.forEach((p,i)=>{const target=targets[i%targets.length],t=ease(u),spread=Math.sin(u*Math.PI)*30;ctx.fillStyle=target.color;ctx.globalAlpha=Math.min(1,u*6);ctx.fillRect(lerp(p.x,target.x,t)+Math.cos(p.seed+u*4)*spread-scrollX,lerp(p.y,target.y,t)+Math.sin(p.seed+u*4)*spread-scrollY,1.5,1.5)});ctx.globalAlpha=1;if(u>.85)fighters.forEach(f=>stick(f,0,false,ease((u-.85)/.15)));if(player.active)stick(player,elapsed,true);return}
  word.style.opacity=String(ease((spawnAge-3.8)/1.2));if(elapsed-coverAt>1.2){refreshCovers();coverAt=elapsed;}const live=fighters.filter(f=>f.hp>0),area=bounds();player.cool=Math.max(0,player.cool-dt);player.invulnerable=Math.max(0,player.invulnerable-dt);if(player.hp<=0){player.respawn-=dt;if(player.respawn<=0){player.hp=100;player.invulnerable=2}}
  if(live.length+(player.active&&player.hp>0?1:0)<=3)finalDuel=true;const arenaCovers=finalDuel?[]:covers;canvas.dataset.coverEnabled=String(!finalDuel);
  if(!roundEnd){
   for(const f of live){f.cool-=dt;f.hit=Math.max(0,f.hit-dt);const enemies=live.filter(other=>other.id!==f.id);if(player.active&&player.hp>0&&player.invulnerable<=0)enemies.push(player);
    const target=enemies.sort((a,b)=>(Math.hypot(a.x-f.x,a.y-f.y)+(a.state==='hidden'?200:0))-(Math.hypot(b.x-f.x,b.y-f.y)+(b.state==='hidden'?200:0)))[0];if(!target)continue;
    const freeCover=arenaCovers.filter(c=>!live.some(other=>other!==f&&other.cover&&Math.hypot(other.cover.x+other.cover.w/2-c.x-c.w/2,other.cover.y-c.y)<30));const intent=tacticalIntent(f,target,bullets,freeCover,dt,elapsed,!finalDuel);if(intent.dodging)dodges++;f.vx=intent.vx;f.vy=intent.vy;f.x=clamp(f.x+intent.vx*dt,area.left,area.right);f.y=clamp(f.y+intent.vy*dt,area.top,area.bottom);
    if(f.cool<=0&&intent.fire){const origin={x:f.x+(target.x<f.x?-12:12),y:f.y-17},aim={x:target.x,y:target.y-15};const blocked=arenaCovers.some(c=>{const t=segmentBoxHit(origin,aim,c);return t!==null&&t>.01&&t<.98});if(!blocked){shoot(f,target,f.id,f.color);f.cool=random(.65,1.2)}else f.cool=.18}
   }
   for(let i=bullets.length-1;i>=0;i--){const b=bullets[i],previous={x:b.x,y:b.y};b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(arenaCovers.some(c=>{const t=segmentBoxHit(previous,b,c);return t!==null})){coverBlocks++;b.life=0;sparks.push({x:b.x,y:b.y,vx:0,vy:-12,life:.16,color:'#b6c9cd'})}
    else {let hit=live.find(f=>f.hp>0&&f.id!==b.id&&segmentBoxHit(previous,b,{x:f.x-10,y:f.y-31,w:20,h:33})!==null);if(!hit&&b.id!==-1&&player.active&&player.hp>0&&player.invulnerable<=0&&segmentBoxHit(previous,b,{x:player.x-10,y:player.y-31,w:20,h:33})!==null)hit=player;
     if(hit){hit.hp=Math.max(0,hit.hp-20);hit.hit=.15;if(b.id===-1)hits++;if(hit===player&&player.hp===0)player.respawn=2;for(let j=0;j<6;j++)sparks.push({x:b.x,y:b.y,vx:random(-65,65),vy:random(-65,65),life:.35,color:b.color});b.life=0}}
    if(b.life<=0)bullets.splice(i,1)
   }
   const survivors=fighters.filter(f=>f.hp>0);if(survivors.length===0||(survivors.length===1&&(!player.active||player.hp<=0))){roundEnd=elapsed;if(survivors.length===0&&player.hp>0)wins++}
  }
  for(const f of fighters)if(f.hp>0)stick(f,elapsed);else{ctx.strokeStyle=f.color;ctx.globalAlpha=.2;ctx.beginPath();ctx.moveTo(f.x-7-scrollX,f.y-scrollY);ctx.lineTo(f.x+7-scrollX,f.y-scrollY);ctx.stroke();ctx.globalAlpha=1}
  for(const b of bullets){ctx.fillStyle=b.color;ctx.fillRect(b.x-scrollX-2,b.y-scrollY-1,4,1.5)}
  sparks=sparks.filter(p=>p.life>0);for(const p of sparks){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life/.35);ctx.fillStyle=p.color;ctx.fillRect(p.x-scrollX,p.y-scrollY,1.5,1.5)}ctx.globalAlpha=1;
  if(player.active)stick(player,elapsed,true,player.hp>0?1:.4);
  if(roundEnd&&elapsed-roundEnd>2.5){const winner=fighters.find(f=>f.hp>0)?.color||(player.hp>0?player.color:null);round++;newRound(winner)}
  canvas.dataset.alive=String(fighters.filter(f=>f.hp>0).length);canvas.dataset.playerHits=String(hits);canvas.dataset.playerActive=String(player.active);const hidden=fighters.filter(f=>f.hp>0&&f.state==='hidden').length;peakHidden=Math.max(peakHidden,hidden);canvas.dataset.hidden=String(hidden);canvas.dataset.peakHidden=String(peakHidden);canvas.dataset.coverBlocks=String(coverBlocks);canvas.dataset.dodges=String(dodges);canvas.dataset.health=JSON.stringify(fighters.map(f=>({id:f.id,hp:Math.ceil(f.hp),state:f.state,champion:f.champion})));const label=`KOLO ${round} · ZDRAVÍ ${Math.ceil(player.hp)} · ZÁSAHY ${hits}`;if(status.textContent!==label)status.textContent=label;
 }
 reduced.addEventListener('change',()=>{hidePlayer();word.style.opacity=''});requestAnimationFrame(frame);
}
function start(){const attach=()=>mountArena();new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});attach()}
if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});
