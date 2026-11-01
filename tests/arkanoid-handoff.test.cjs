const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('assets/morfiai-arkanoid.js','utf8');
function fixture({scroll=0,reduced=false,late=false}={}){
  const created=[],events={},frames=[],classes=new Set();let guide;
  const ctx=new Proxy({}, {get:(_,key)=>()=>{},set:()=>true});
  function element(tag='div'){
    const e={tagName:tag.toUpperCase(),style:{},dataset:{},children:[],isConnected:true,
      appendChild(n){this.children.push(n)},querySelector(){return this.children.find(n=>n.tagName==='CANVAS')},
      getContext(){return ctx},getBoundingClientRect(){const n=(this.style.transform||'').match(/-?\d+(?:\.\d+)?/g)||['0','0'];return {left:+n[0],top:+n[1],width:16,height:16}},
    };created.push(e);return e;
  }
  const hero=element(),body=element();hero.getBoundingClientRect=()=>({left:0,top:-window.scrollY,width:1440,height:1000});
  function addGuide(){guide=element();guide.id='morfiai-guide-ball';guide.dataset.ballOwner='guide';return guide}
  if(!late)addGuide();
  const document={body,readyState:'complete',documentElement:{classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k)}}},
    getElementById:id=>created.find(e=>e.id===id),
    querySelector:s=>s==='.nex-dragon-video-section'?hero:s==='.min-h-screen'?body:null,
    createElement:element,addEventListener(){},
  };
  const window={scrollY:scroll,devicePixelRatio:1,matchMedia:()=>({matches:reduced}),addEventListener(k,f){(events[k]??=[]).push(f)}};
  vm.runInNewContext(source,{window,document,performance:{now:()=>0},requestAnimationFrame:f=>frames.push(f),setTimeout(){},Math});
  let time=0;
  return {window,classes,created,addGuide,get guide(){return guide},
    frame(){const callbacks=frames.splice(0);time+=16;callbacks.forEach(f=>f(time))},
    scrollTo(y){window.scrollY=y;(events.scroll||[]).forEach(f=>f())},
    move(x,y){(events.mousemove||[]).forEach(f=>f({clientX:x,clientY:y}))},
  };
}
const f=fixture();const original=f.guide;f.frame();
assert.equal(original.dataset.ballOwner,'arkanoid');assert.equal(f.classes.has('morfiai-game-cursor'),true);
f.scrollTo(800);f.frame();assert.equal(f.guide,original);assert.equal(original.dataset.ballOwner,'guide');
assert.equal(f.classes.has('morfiai-game-cursor'),false);assert.ok(Number.isFinite(+original.dataset.resumeX));
const handedX=original.dataset.resumeX;original.style.transform='translate(10px, 20px)';f.frame();
assert.equal(original.dataset.resumeX,handedX,'release must not overwrite the moving guide every frame');
f.scrollTo(0);f.frame();assert.equal(f.guide,original);assert.equal(original.dataset.ballOwner,'arkanoid');
assert.equal(f.created.filter(e=>e.id==='morfiai-guide-ball').length,1);
const deep=fixture({scroll:900});deep.frame();assert.equal(deep.guide.dataset.ballOwner,'guide');
const reduced=fixture({reduced:true});reduced.frame();assert.equal(reduced.guide.dataset.ballOwner,'guide');
const late=fixture({late:true});late.frame();assert.equal(late.created.filter(e=>e.id==='morfiai-guide-ball').length,0);
const lateOriginal=late.addGuide();late.frame();assert.equal(late.guide,lateOriginal);assert.equal(lateOriginal.dataset.ballOwner,'arkanoid');
const free=fixture();free.move(540,300);for(let i=0;i<35;i++)free.frame();
const paddle=free.created.find(e=>e.id==='morfiai-paddle-cursor');
let xy=paddle.style.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
assert.ok(Math.abs(xy[0]-495)<2, 'platform follows horizontal pointer position');
assert.ok(Math.abs(xy[1]-296)<2, 'platform follows vertical pointer position');
free.move(1100,700);for(let i=0;i<35;i++)free.frame();
xy=paddle.style.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
assert.ok(Math.abs(xy[0]-1055)<2);assert.ok(Math.abs(xy[1]-696)<2);
free.scrollTo(800);free.frame();assert.equal(paddle.style.display,'none');
console.log('PASS: same guide node; top/down/top; one-time release; deep links; reduced motion; late mount; free X/Y cursor paddle; hidden after scroll.');
