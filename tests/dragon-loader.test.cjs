const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/dragon-viewer.js','utf8').replace(/import\(/g,'__import(');
async function fixture(fail=false){
 const timers=[],changes=[],events={},status={},retry={hidden:true,addEventListener(k,f){this[k]=f}};
 const model={availableAnimations:['idle','jump'],play(){},addEventListener(k,f){events[k]=f},setAttribute(k,v){changes.push([k,v])}};
 const names=new Set(),wrap={dataset:{},classList:{add:k=>names.add(k),remove:k=>names.delete(k)},setAttribute(){},querySelector:s=>s==='model-viewer'?model:s==='button'?retry:status};
 const controlButton=()=>({addEventListener(){},setAttribute(){}});const controls={querySelector:s=>s==='select'?{addEventListener(){},replaceChildren(){}}:{},querySelectorAll:()=>[controlButton(),controlButton(),controlButton()]};let created=0;wrap.appendChild=()=>{};wrap.addEventListener=()=>{};
 let inserted=false;const doc={readyState:'complete',body:{},getElementById:id=>id==='funkce'?{insertBefore(){inserted=true}}:inserted?wrap:null,querySelector:()=>({}),createElement:()=>++created===1?wrap:created===2?controls:{}};
 vm.runInNewContext(source,{document:doc,MutationObserver:class{observe(){}},matchMedia:()=>({matches:false}),setTimeout:f=>timers.push(f),__import:()=>fail?Promise.reject(Error('offline')):Promise.resolve({})});
 await new Promise(resolve=>setImmediate(resolve));return {timers,changes,events,status,retry,wrap,names};
}
(async()=>{
 const f=await fixture();assert.match(f.wrap.innerHTML,/loading="eager"/);assert.match(f.wrap.innerHTML,/src="\/assets\/laya-complete-670.glb"/);
 for(const timer of f.timers)timer();assert.equal(f.changes.length,0,'slow loading must not restart the GLB request');assert.equal(f.wrap.dataset.loadState,'loading');
 f.events.load();assert.equal(f.wrap.dataset.loadState,'loaded');assert.ok(f.names.has('nex-glb-loaded'));
 const broken=await fixture(true);assert.equal(broken.wrap.dataset.loadState,'error');assert.equal(broken.retry.hidden,false);
 broken.retry.click();assert.equal(broken.changes.length,1,'only explicit retry may replace the source');
 assert.match(broken.changes[0][1],/retry=1$/);
 console.log('PASS: same-origin runtime; eager model; no restart on slow load; genuine load state; visible error and explicit retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
