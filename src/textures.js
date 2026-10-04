import * as THREE from 'three';
function randomSource(seed) {return () => {seed = (seed * 1664525 + 1013904223) >>> 0;return seed / 4294967296;};}
function canvas(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
function texture(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;return t;}
export function moonTexture(){
  const c=canvas(1024,512),ctx=c.getContext('2d'),rand=randomSource(12917);
  const grids=[8,16,32,64,128,256].map(size=>({size,values:Float32Array.from({length:size*size},()=>rand())}));
  const noise=(x,y,g)=>{const gx=x*g.size,gy=y*g.size,ix=Math.floor(gx),iy=Math.floor(gy);let tx=gx-ix,ty=gy-iy;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty);const at=(a,b)=>g.values[((b+g.size)%g.size)*g.size+(a+g.size)%g.size];return (at(ix,iy)*(1-tx)+at(ix+1,iy)*tx)*(1-ty)+(at(ix,iy+1)*(1-tx)+at(ix+1,iy+1)*tx)*ty;};
  const img=ctx.createImageData(c.width,c.height);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const nx=x/c.width,ny=y/c.height;
    let v=0,amp=1,sum=0;for(const g of grids){v+=noise(nx,ny,g)*amp;sum+=amp;amp*=.55;}
    v/=sum;const maria=Math.max(0,.49-noise(nx,ny,grids[1]))*175;
    const col=102+v*115-maria+(rand()-.5)*21;
    const i=(y*c.width+x)*4;img.data[i]=col*.95;img.data[i+1]=col*.98;img.data[i+2]=col;img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  for(let i=0;i<420;i++){
    const x=rand()*1024,y=rand()*512,r=1.2+Math.pow(rand(),3)*27;
    for(const offset of [-1024,0,1024]){
      ctx.save();ctx.translate(x+offset,y);ctx.scale(1/Math.max(.38,Math.sin(y/512*Math.PI)),1);
      let grad=ctx.createRadialGradient(0,0,r*.38,0,0,r*1.28);grad.addColorStop(0,'#10151c00');grad.addColorStop(.43,'#3c414980');grad.addColorStop(.63,'#2e333c90');grad.addColorStop(.79,'#eaf1fa7d');grad.addColorStop(1,'#ced8e800');
      ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,r*1.28,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }
  return texture(c);
}
export function letterTexture(){
  const c=canvas(2048,1024),ctx=c.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,2048,1024);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.font='900 164px Arial';
  for(const x of [512,1536]){ctx.fillText('HELLO',x,420);ctx.fillText('WORLD.',x,580);}
  ctx.font='18px monospace';ctx.letterSpacing='6px';for(const x of [512,1536])ctx.fillText('A N G E L D L O   /   D I G I T A L   U N I V E R S E',x,735);
  return texture(c);
}
export function glowTexture(){const c=canvas(128,128),ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(179,224,255,1)');g.addColorStop(.09,'rgba(135,203,255,.75)');g.addColorStop(.24,'rgba(76,122,255,.18)');g.addColorStop(1,'rgba(40,80,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return texture(c);}
