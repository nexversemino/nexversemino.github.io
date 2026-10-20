// Shared deterministic combat rules; coordinates are in document space.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function segmentBoxHit(a,b,box){let near=0,far=1;for(const [axis,min,size] of [['x',box.x,box.w],['y',box.y,box.h]]){const delta=b[axis]-a[axis];if(Math.abs(delta)<1e-8){if(a[axis]<min||a[axis]>min+size)return null;continue}let t1=(min-a[axis])/delta,t2=(min+size-a[axis])/delta;if(t1>t2)[t1,t2]=[t2,t1];near=Math.max(near,t1);far=Math.min(far,t2);if(near>far)return null}return near}
export function incomingThreat(f,bullets){let best=null;for(const b of bullets){if(b.id===f.id)continue;const dx=f.x-b.x,dy=f.y-16-b.y,speed=b.vx*b.vx+b.vy*b.vy;if(!speed)continue;const t=(dx*b.vx+dy*b.vy)/speed;if(t<0||t>.65)continue;const distance=Math.hypot(dx-b.vx*t,dy-b.vy*t);if(distance<32&&(!best||t<best.time))best={bullet:b,time:t,distance}}return best}
export function chooseCover(f,target,covers){return covers.filter(c=>c.w>8&&c.h>25&&Math.hypot(c.x+c.w/2-f.x,c.y+c.h*.75-f.y)<650).map(c=>({cover:c,score:Math.hypot(c.x+c.w/2-f.x,c.y+c.h*.75-f.y)+Math.hypot(c.x-target.x,c.y-target.y)*.08})).sort((a,b)=>a.score-b.score)[0]?.cover||null}
export function tacticalIntent(f,target,bullets,covers,dt,time,allowCover=true){
 if(!allowCover){if(['hidden','seeking','peeking'].includes(f.state))f.state='flanking';f.cover=null;f.coverCooldown=Math.max(f.coverCooldown||0,10)}
 f.state=f.state||'flanking';f.stateTime=Math.max(0,(f.stateTime||0)-dt);f.coverCooldown=Math.max(0,(f.coverCooldown||0)-dt);f.dodgeCooldown=Math.max(0,(f.dodgeCooldown||0)-dt);const threat=incomingThreat(f,bullets);let goal=null,fire=true;
 if(f.state==='hidden'){
  fire=false;if(f.stateTime<=0){f.state='peeking';f.stateTime=1.2;f.cool=Math.min(f.cool,.1)}
 }else if(f.state==='peeking'){
  if(f.stateTime<=0){f.coverCycles=(f.coverCycles||0)+1;f.state='flanking';f.coverCooldown=10;f.cover=null}
 }
 if(allowCover&&(f.state==='flanking'||f.state==='evading')&&f.coverCooldown<=0&&(f.hp<40||(threat&&f.hp<80))){
  f.cover=chooseCover(f,target,covers);f.coverCycles=0;f.stateTime=3.5;if(f.cover)f.state='seeking';else f.coverCooldown=2;
 }
 if(f.cover&&(f.state==='seeking'||f.state==='hidden'||f.state==='peeking')){
  const c=f.cover,side=target.x<c.x+c.w/2?-1:1;goal={x:c.x+c.w/2,y:c.y+Math.min(c.h-2,Math.max(34,c.h*.78))};
  if(f.state==='peeking'){goal.x=side<0?c.x-20:c.x+c.w+20;goal.y=c.y-8;}
  if(f.state==='hidden'){goal=null;fire=false}
  if(f.state==='seeking'&&Math.hypot(goal.x-f.x,goal.y-f.y)<6){f.state='hidden';f.stateTime=.8+(f.id%3)*.2;fire=false;goal=null}
 }
 let vx=0,vy=0;
 if(goal){const dx=goal.x-f.x,dy=goal.y-f.y,d=Math.hypot(dx,dy)||1,speed=f.state==='seeking'?80:65;vx=dx/d*Math.min(speed,d/Math.max(dt,.01));vy=dy/d*Math.min(speed,d/Math.max(dt,.01))}
 else if(f.state!=='hidden'){
  const dx=target.x-f.x,dy=target.y-f.y,d=Math.hypot(dx,dy)||1,radial=d>250?35:d<140?-45:0,side=f.id%2?1:-1;
  vx=dx/d*radial-dy/d*side*24;vy=dy/d*radial+dx/d*side*24;
 }
 if(threat&&f.state!=='hidden'&&f.dodgeCooldown<=0){const b=threat.bullet,speed=Math.hypot(b.vx,b.vy)||1,side=f.id%2?1:-1;f.dodgeX=-b.vy/speed*side*120;f.dodgeY=b.vx/speed*side*120;f.dodgeUntil=time+.32;f.dodgeCooldown=.9}
 if(time<(f.dodgeUntil||0)){vx+=f.dodgeX;vy+=f.dodgeY}
 return {vx,vy,fire:fire&&f.state!=='seeking',hidden:f.state==='hidden',dodging:time<(f.dodgeUntil||0)};
}
