import { createScene } from './scene.js';
import { sceneState, scrollProgress, clamp } from './story.js';

const world=document.querySelector('#world'),canvas=document.querySelector('#scene');
const chapters=[...document.querySelectorAll('[data-scene]')];
const copies=chapters.map(s=>s.querySelector('.chapter-copy'));
const sceneLabels=chapters.map(s=>s.querySelector('.scene-label'));
const controls=document.querySelector('.experience-controls');
const button=document.querySelector('.motion-control');
const label=button.querySelector('.motion-label');
const chapterLinks=[...document.querySelectorAll('.chapter-nav a')];
const preference=matchMedia('(prefers-reduced-motion: reduce)');
let savedPreference=null;try{savedPreference=localStorage.getItem('angeldlo-motion');}catch{/* Storage is optional. */}
let paused=savedPreference==='paused'||(savedPreference!=='active'&&preference.matches),explicitPreference=['paused','active'].includes(savedPreference),scene=null,failed=false,raf=0,previous=0,time=0,progress=0,target=0,anchors=[],outside=false,disposed=false;
let pointer={x:0,y:0},pointerTarget={x:0,y:0},width=innerWidth,height=innerHeight;
const abort=new AbortController();const eventOptions={signal:abort.signal};
function updateButton(){button.setAttribute('aria-pressed',String(paused));label.textContent=paused?'Activar movimiento':'Pausar movimiento';button.querySelector('.motion-icon').textContent=paused?'▷':'Ⅱ';document.documentElement.classList.toggle('motion-paused',paused);document.body.classList.toggle('motion-paused',paused);}
function measure(){width=document.documentElement.clientWidth;height=innerHeight;anchors=chapters.map(e=>e.getBoundingClientRect().top+scrollY);anchors.push(document.querySelector('#apps').getBoundingClientRect().top+scrollY);scene?.resize(width,height);updateScroll();}
function updateScroll(){target=scrollProgress(scrollY,anchors);outside=target>=3.85;document.body.dataset.outside=String(outside);requestFrame();}
function updateUI(p){
  const state=sceneState(p);const chapter=state.chapter;
  document.body.dataset.chapter=String(chapter);
  chapterLinks.forEach((link,i)=>{if(i===chapter)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
  controls.style.setProperty('--progress',String(clamp(p/3)));
  world.style.opacity=String(1-state.exit);
  // Section text remains ordinary selectable HTML. Only outgoing chapters are faded.
  for(let i=0;i<copies.length;i++){
    const fade=copies[i].contains(document.activeElement)?1:1-clamp((p-i-.37)/.45);
    copies[i].style.opacity=String(fade);
    sceneLabels[i].style.opacity=String(fade);
    copies[i].style.transform=paused?'none':`translate3d(0,${-clamp(p-i,0,1)*22}px,0)`;
  }
  return state;
}
function requestFrame(){if(!raf&&scene&&!disposed&&!failed&&!document.hidden)raf=requestAnimationFrame(tick);}
function tick(now){
  raf=0;if(disposed||document.hidden)return;
  if(!paused&&previous&&now-previous<1000/(width<761?30:60)-1){requestFrame();return;}
  const delta=previous?Math.min((now-previous)/1000,.07):1/60;previous=now;
  if(!paused&&!outside){time+=delta;progress+=(target-progress)*(1-Math.exp(-delta*8));pointer.x+=(pointerTarget.x-pointer.x)*(1-Math.exp(-delta*3));pointer.y+=(pointerTarget.y-pointer.y)*(1-Math.exp(-delta*3));}else{progress=target;pointer.x=0;pointer.y=0;}
  if(Math.abs(target-progress)<.0005)progress=target;
  const state=updateUI(progress);
  if(scene&&!outside)scene.render(paused?sceneState(Math.round(target)):state,time,pointer);
  if(!paused&&!outside)requestFrame();
}
function fail(){if(failed)return;failed=true;world.classList.remove('ready');world.dataset.renderer='fallback';document.body.classList.add('scene-failed');controls.hidden=true;for(const copy of copies){copy.style.opacity='1';copy.style.transform='none';}sceneLabels.forEach(el=>el.style.opacity='1');if(raf)cancelAnimationFrame(raf);raf=0;scene?.dispose();scene=null;}
button.addEventListener('click',()=>{explicitPreference=true;paused=!paused;try{localStorage.setItem('angeldlo-motion',paused?'paused':'active');}catch{/* Storage is optional. */}updateButton();previous=0;requestFrame();},eventOptions);
preference.addEventListener('change',()=>{if(!explicitPreference){paused=preference.matches;updateButton();requestFrame();}},eventOptions);
window.addEventListener('scroll',updateScroll,{passive:true,signal:abort.signal});
window.addEventListener('resize',measure,{passive:true,signal:abort.signal});
window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!paused){pointerTarget.x=(e.clientX/width-.5)*2;pointerTarget.y=-(e.clientY/height-.5)*2;}},{passive:true,signal:abort.signal});
document.addEventListener('visibilitychange',()=>{previous=0;if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else requestFrame();},eventOptions);
document.addEventListener('focusin',requestFrame,eventOptions);
document.addEventListener('focusout',requestFrame,eventOptions);
window.addEventListener('pagehide',e=>{if(e.persisted){if(raf)cancelAnimationFrame(raf);raf=0;return;}disposed=true;abort.abort();if(raf)cancelAnimationFrame(raf);scene?.dispose();},eventOptions);
window.addEventListener('pageshow',e=>{if(e.persisted){previous=0;measure();requestFrame();}},eventOptions);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail();},eventOptions);
updateButton();measure();
// Yield one paint: navigation, copy and a designed fallback are usable immediately.
requestAnimationFrame(async now=>{
  if(disposed)return;
  try{const built=await createScene(canvas);if(disposed||failed){built.dispose();return;}scene=built;scene.resize(width,height);progress=target;previous=now;const state=updateUI(progress);if(!outside)scene.render(paused?sceneState(Math.round(progress)):state,0,pointer);world.classList.add('ready');world.dataset.renderer='webgl';controls.hidden=false;if(!paused)requestFrame();}catch(error){console.warn('La escena 3D no está disponible; se mantiene la vista estática.',error);fail();}
});
document.fonts?.ready.then(()=>{if(!disposed)measure();});
