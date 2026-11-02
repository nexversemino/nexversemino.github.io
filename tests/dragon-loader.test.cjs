const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/dragon-viewer.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/import\(/g,'__import(');
class E{
 constructor(){this.events={};this.dataset={};this.attrs={};this.children=[];this.classList={add(){},remove(){}};this.availableAnimations=['idle','walk'];this.paused=true}
 setAttribute(k,v){this.attrs[k]=v} addEventListener(k,f){this.events[k]=f} replaceChildren(...c){this.children=c}appendChild(c){this.children.push(c)}play(){this.paused=false;this.events.play?.()}pause(){this.paused=true;this.events.pause?.()}
}
async function fixture(fail=false){
 const wrap=new E(),picker=new E(),select=new E(),controls=new E(),buttons=[new E(),new E(),new E()],counter=new E(),slot=new E(),status=new E(),retry=new E(),models=[];
 controls.querySelectorAll=()=>buttons;const map={'[aria-label="Postava v náhledu"]':picker,'[aria-label="Animace postavy"]':select,'.nex-animation-controls':controls,'.nex-animation-count':counter,'.nex-model-slot':slot,'[role="status"]':status,'.nex-glb-loading button':retry,'[aria-label="Mrkání"]':new E(),'[aria-label="Mluva"]':new E(),'[data-blink-label]':new E()};wrap.querySelector=k=>map[k];let inserted=false;
 const characters=[{id:'laya',label:'Laya',src:'/assets/laya-complete-670.glb'},{id:'rose',label:'Rose',src:'/assets/showcase-rose.glb'}];
 const document={body:{},readyState:'complete',getElementById:id=>id==='funkce'?{insertBefore(){inserted=true}}:inserted?wrap:null,querySelector:()=>({}),createElement(tag){if(tag==='div')return wrap;const e=new E();if(tag==='model-viewer')models.push(e);return e}};
 vm.runInNewContext(source,{attachDownloads:()=>({update(){},setLabels(){}}),bindFace:()=>()=>{},characters,labels:{idle:'Klidový postoj',walk:'Chůze'},document,MutationObserver:class{observe(){}},matchMedia:()=>({matches:false}),__import:()=>fail?Promise.reject(Error('offline')):Promise.resolve({getFacialScene:()=>({})})});await new Promise(setImmediate);
 return {wrap,picker,select,buttons,slot,status,retry,models};
}
(async()=>{
 const f=await fixture(),m=f.models[0];assert.equal(m.attrs.loading,'eager');assert.equal(m.attrs.src,'/assets/laya-complete-670.glb');assert.equal(m.attrs['auto-rotate'],undefined);
 m.events.load();assert.equal(f.wrap.dataset.loadState,'loaded');assert.equal(f.select.children[1].textContent,'Chůze');f.buttons[1].events.click();assert.equal(m.animationName,'walk');
 f.picker.value='rose';await f.picker.events.change();await new Promise(setImmediate);const rose=f.models[1];assert.equal(rose.attrs.src,'/assets/showcase-rose.glb');assert.equal(rose.attrs['camera-orbit'],'180deg 75deg auto');m.events.load();assert.equal(f.wrap.dataset.loadState,'loading','obsolete load must not reset current character');rose.events.load();assert.equal(f.wrap.dataset.character,'rose');assert.equal(f.wrap.dataset.loadState,'loaded');
 const bad=await fixture(true);assert.equal(bad.wrap.dataset.loadState,'error');assert.equal(bad.retry.hidden,false);
 const catalog=JSON.parse(fs.readFileSync('assets/character-catalog.json')),labels=JSON.parse(fs.readFileSync('assets/animation-labels-cs.json'));assert.equal(catalog.length,6);for(const c of catalog){assert.ok(fs.existsSync('.'+c.src));assert.ok(c.clips.length);for(const n of c.clips)assert.ok(labels[n],n)}
 console.log('PASS: six real assets; translated labels; no auto rotation; animation switching; character switching; stale load isolation; visible errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
