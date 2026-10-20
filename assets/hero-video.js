// Source for the local video enhancement. Original published bundles stay unchanged.
function attachDragonVideo(){
 const brand=[...document.querySelectorAll('header span')].find(el=>el.textContent.trim()==='MORFIAI'&&!el.closest('.morfiai-brand'));
 if(brand){
  const link=document.createElement('a');link.className='morfiai-brand';link.href='#';link.setAttribute('aria-label','Morfiai — úvodní stránka');
  const logo=document.createElement('img');logo.src='assets/morfiai-logo.svg';logo.alt='';logo.width=68;logo.height=68;logo.className='morfiai-brand-symbol';
  const word=document.createElement('span');word.className='morfiai-brand-word text-neon-gradient';word.textContent='MORFIAI';link.append(logo,word);brand.replaceWith(link);
 }

 for(const image of document.querySelectorAll('img[src="assets/hero-CWIhvXXv.png"]')){
  const video=document.createElement('video');video.className='nex-dragon-video';
  const av1=!!video.canPlayType('video/mp4; codecs="av01.0.12M.08"');
  video.src=av1?'assets/dragon-loop-uhd-web2.mp4':'assets/dragon-loop-uhd.mp4';video.poster='assets/dragon-loop-poster.jpg';
  video.muted=true;video.defaultMuted=true;video.loop=true;video.autoplay=true;video.playsInline=true;video.preload='auto';
  video.playbackRate=0.82; // o trochu pomalejší plynulý pohyb

  video.setAttribute('autoplay','');video.setAttribute('loop','');video.controls=false;video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-label','Neonový drak — animované video ve smyčce');
  image.parentElement.classList.add('nex-dragon-video-layer');image.parentElement.parentElement.classList.add('nex-dragon-video-stage');image.closest('section')?.classList.add('nex-dragon-video-section');image.replaceWith(video);
  const play=()=>{if(!document.hidden)video.play().catch(()=>{});};
  video.addEventListener('canplay',play);
  video.addEventListener('error',()=>{if(!video.dataset.fallback){video.dataset.fallback='true';video.src='assets/dragon-loop.mp4';video.load();play();}});
  play();
 }
}
const observer=new MutationObserver(attachDragonVideo);
function start(){observer.observe(document.body,{childList:true,subtree:true});attachDragonVideo()}
if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
document.addEventListener('visibilitychange',()=>{for(const video of document.querySelectorAll('.nex-dragon-video')){if(document.hidden)video.pause();else video.play().catch(()=>{})}});
