import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { moonTexture, letterTexture, glowTexture } from './textures.js';
import { mix, renderScale } from './story.js';

export async function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas,antialias:false,alpha:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x06080e,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,70);camera.position.set(0,.05,7.8);
  const pmrem=new THREE.PMREMGenerator(renderer),envRoom=new RoomEnvironment();
  const env=pmrem.fromScene(envRoom,.03);scene.environment=env.texture;envRoom.dispose();pmrem.dispose();
  const ambient=new THREE.AmbientLight(0x8ba5da,.14);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xd7ebff,3.7);key.position.set(-3,3.5,3);scene.add(key);
  const rim=new THREE.DirectionalLight(0x738aff,1.8);rim.position.set(4,-.5,-2);scene.add(rim);
  const coreLight=new THREE.PointLight(0x719fff,4,7,2);coreLight.position.set(0,0,.4);
  const group=new THREE.Group();scene.add(group);group.add(coreLight);
  const loader=new THREE.TextureLoader();
  const [moon,heightMap]=await Promise.all([loader.loadAsync('assets/moon-color.jpg').catch(()=>moonTexture()),loader.loadAsync('assets/moon-height.jpg').catch(()=>null)]);
  moon.colorSpace=THREE.SRGBColorSpace;moon.wrapS=THREE.RepeatWrapping;
  const letters=letterTexture(),glow=glowTexture();
  moon.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
  const sphereGeometry=new THREE.SphereGeometry(1.52,96,64);
  const ledMaterial=new THREE.ShaderMaterial({transparent:true,uniforms:{uTime:{value:0},uAlpha:{value:1},uText:{value:letters}},vertexShader:`
    varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
    void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vPosition=-p.xyz;gl_Position=projectionMatrix*p;}
  `,fragmentShader:`
    uniform float uTime;uniform float uAlpha;uniform sampler2D uText;
    varying vec2 vUv;varying vec3 vNormal;varying vec3 vPosition;
    void main(){
      vec2 uv=vUv;float t=uTime*.12;
      float wave=sin(uv.y*12.+uv.x*7.+t)*.5+.5;
      vec3 blue=vec3(.055,.075,.7),pink=vec3(.75,.045,.55),cyan=vec3(.2,.68,1.);
      vec3 base=mix(blue,pink,smoothstep(.22,.85,uv.y+sin(uv.x*8.+t)*.12));
      base=mix(base,cyan,pow(max(0.,sin(uv.y*19.+uv.x*5.+t)),12.)*.55);
      float line=pow(max(0.,sin(uv.y*125.+sin(uv.x*17.+t)*3.)),18.);
      base+=line*vec3(.13,.08,.3);
      vec2 tuv=vec2(fract(uv.x+uTime*.007),uv.y);
      float lettering=texture2D(uText,tuv).r;
      vec3 col=mix(base,vec3(1.,.77,.95)*1.65,lettering);
      vec2 cell=fract(uv*vec2(480.,240.))-.5;
      float pixel=1.-smoothstep(.31,.48,length(cell));
      col*=.22+.78*pixel;
      float facing=max(0.,dot(normalize(vNormal),normalize(vPosition)));
      col*=.25+.75*pow(facing,.4);
      col+=pow(1.-facing,3.)*vec3(.12,.09,.48);
      gl_FragColor=vec4(col,uAlpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `});
  const led=new THREE.Mesh(sphereGeometry,ledMaterial);led.rotation.z=-.13;group.add(led);
  const shellGroup=new THREE.Group();group.add(shellGroup);
  const shellMaterial=new THREE.MeshStandardMaterial({map:moon,bumpMap:heightMap||moon,bumpScale:.065,roughness:.94,metalness:.07,color:0xcdd4df,transparent:true,opacity:0,side:THREE.DoubleSide,envMapIntensity:.4});
  const metalTransition={value:0};
  shellMaterial.onBeforeCompile=shader=>{shader.uniforms.uMetal=metalTransition;shader.fragmentShader='uniform float uMetal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.09,.14,.23), uMetal);');};
  const moonMaterial=new THREE.MeshStandardMaterial({map:moon,bumpMap:heightMap||moon,bumpScale:.085,displacementMap:heightMap,displacementScale:.018,roughness:1,metalness:0,color:0xa3abbc,transparent:true,opacity:0,envMapIntensity:.04});
  const wholeMoon=new THREE.Mesh(sphereGeometry,moonMaterial);group.add(wholeMoon);
  const edgeMaterial=new THREE.LineBasicMaterial({color:0x93b5fa,transparent:true,opacity:0});
  const panels=[];
  for(let iy=0;iy<4;iy++)for(let ix=0;ix<8;ix++){
    const phi=ix*Math.PI/4,theta=iy*Math.PI/4;
    const geo=new THREE.SphereGeometry(1.51,18,14,phi,Math.PI/4*.995,theta+.002,Math.PI/4-.004);
    const uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(ix+uv.getX(i))/8,1-(iy+(1-uv.getY(i)))/4);
    const piece=new THREE.Group();const mesh=new THREE.Mesh(geo,shellMaterial);piece.add(mesh);
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo,25),edgeMaterial);piece.add(edge);
    const pm=phi+Math.PI/8,tm=theta+Math.PI/8;
    const direction=new THREE.Vector3(-Math.cos(pm)*Math.sin(tm),Math.cos(tm),Math.sin(pm)*Math.sin(tm));
    shellGroup.add(piece);panels.push({piece,direction,ix,iy});
  }
  const inner=new THREE.Group();group.add(inner);
  const darkMat=new THREE.MeshStandardMaterial({color:0x18263e,metalness:.92,roughness:.22,envMapIntensity:1.1,transparent:true,opacity:0});
  const metalMat=new THREE.MeshStandardMaterial({color:0x9bb7d8,metalness:.9,roughness:.23,envMapIntensity:1.2,transparent:true,opacity:0});
  const coreMat=new THREE.MeshStandardMaterial({color:0x8cb3ff,emissive:0x3a70ff,emissiveIntensity:2,metalness:.65,roughness:.2,transparent:true,opacity:0});
  const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.42,1),coreMat);inner.add(core);
  const cage=new THREE.Mesh(new THREE.IcosahedronGeometry(.73,1),darkMat);inner.add(cage);
  const cageWire=new THREE.LineSegments(new THREE.EdgesGeometry(cage.geometry),new THREE.LineBasicMaterial({color:0x91b9ff,transparent:true,opacity:0}));inner.add(cageWire);
  const rings=[];
  for(let i=0;i<3;i++){
    const pivot=new THREE.Group();
    const mesh=new THREE.Mesh(new THREE.TorusGeometry(.98+i*.15,.022,8,128),metalMat);pivot.add(mesh);
    const lightRing=new THREE.Mesh(new THREE.TorusGeometry(.98+i*.15,.004,6,128),coreMat);lightRing.position.z=.023;pivot.add(lightRing);
    pivot.rotation.set(i*.8+.3,i*.65,i*.9);inner.add(pivot);rings.push(pivot);
  }
  const blocks=new THREE.InstancedMesh(new THREE.BoxGeometry(.065,.065,.065),metalMat,180);inner.add(blocks);
  const dummy=new THREE.Object3D();
  for(let i=0;i<180;i++){const a=i*.399963,b=Math.acos(1-2*(i+.5)/180);dummy.position.set(Math.cos(a)*Math.sin(b)*1.13,Math.cos(b)*1.13,Math.sin(a)*Math.sin(b)*1.13);dummy.lookAt(0,0,0);dummy.rotation.z=i;dummy.updateMatrix();blocks.setMatrixAt(i,dummy.matrix);}
  const glowMat=new THREE.SpriteMaterial({map:glow,color:0x879cff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  const coreGlow=new THREE.Sprite(glowMat);coreGlow.scale.set(2.8,2.8,1);inner.add(coreGlow);
  // A quiet field of dust adds depth without a separate full-screen particle effect.
  const dustGeo=new THREE.BufferGeometry(),coords=new Float32Array(270*3);
  let seed=719;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<270;i++){coords[i*3]=(rand()-.5)*19;coords[i*3+1]=(rand()-.5)*12;coords[i*3+2]=-3-rand()*13;}
  dustGeo.setAttribute('position',new THREE.BufferAttribute(coords,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xa8bedb,size:.025,transparent:true,opacity:.5,sizeAttenuation:true,depthWrite:false}));scene.add(dust);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(600,400),.32,.5,.78);composer.addPass(bloom);composer.addPass(new OutputPass());
  let width=1280,height=720,mobile=false;
  function resize(w,h){width=w;height=h;mobile=w<761;const ratio=renderScale(w,h,window.devicePixelRatio);renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);composer.setPixelRatio(ratio);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function render(state,time,pointer){
    const {moon:moonPhase,opening,orbit,exit}=state;
    const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(18))*camera.position.z;
    const viewWidth=viewHeight*width/height;
    const targetScreen=mobile?.50:.735;
    group.position.x=(targetScreen-.5)*viewWidth+pointer.x*.07;
    group.position.y=(mobile?-.185:.015)*viewHeight+pointer.y*.045;
    const fit=mobile?Math.min(viewWidth*.36/1.52,viewHeight*.205/1.52):Math.min(viewWidth*.235/1.52,viewHeight*.355/1.52);
    group.scale.setScalar(fit*state.scale);
    group.rotation.set(.08+pointer.y*.035,mix(-.08,.38,opening)+pointer.x*.09,mix(-.06,.10,opening));
    led.visible=moonPhase<.999;ledMaterial.uniforms.uAlpha.value=1-moonPhase;ledMaterial.uniforms.uTime.value=time;led.rotation.y=-.27+time*.035;led.rotation.z=-.13+Math.sin(time*.13)*.015;
    wholeMoon.visible=moonPhase>.001&&opening<.08;moonMaterial.opacity=moonPhase*(1-Math.min(1,opening/.08));
    wholeMoon.rotation.y=-1.35+Math.sin(time*.035)*.18;wholeMoon.rotation.z=0;
    shellGroup.visible=opening>.001&&state.shell>.001;shellMaterial.opacity=moonPhase*state.shell*Math.min(1,opening/.08);shellMaterial.depthWrite=state.shell>.9;
    shellMaterial.metalness=mix(.07,.8,opening);shellMaterial.roughness=mix(.94,.3,opening);shellMaterial.bumpScale=mix(.065,0,opening);metalTransition.value=opening;
    shellGroup.rotation.y=-1.35+Math.sin(time*.035)*.18+opening*.3;shellGroup.rotation.z=opening*.12;
    edgeMaterial.opacity=opening*.36*state.shell;
    for(const {piece,direction,ix,iy} of panels){
      const spread=opening*(.52+(iy===0||iy===3?.20:0))+orbit*.60;
      piece.position.copy(direction).multiplyScalar(spread);
      piece.position.y+=opening*(iy<2?.23:-.23);
      piece.rotation.set(opening*(iy-1.5)*.10,opening*(ix-3.5)*.036,orbit*(ix%2?1:-1)*.08);
    }
    inner.visible=opening>.001;darkMat.opacity=opening*.74;metalMat.opacity=opening;coreMat.opacity=opening;cageWire.material.opacity=opening*.65;
    core.rotation.set(time*.18,time*.22,time*.09);core.scale.setScalar(1+Math.sin(time*1.3)*.035);
    cage.rotation.copy(core.rotation);cageWire.rotation.copy(core.rotation);
    cage.scale.setScalar(1-orbit*.3);cageWire.scale.copy(cage.scale);
    inner.rotation.y=-time*.08;blocks.rotation.y=time*.12;blocks.rotation.z=opening*.18;
    blocks.scale.setScalar(1+orbit*.45);
    for(let i=0;i<rings.length;i++){rings[i].rotation.x=i*.8+.3+time*(.09+i*.035);rings[i].rotation.y=i*.65+time*.05;rings[i].rotation.z=i*.9+orbit*.4;rings[i].scale.setScalar(1+orbit*.4);}
    metalMat.color.setRGB(mix(.36,.8,orbit),mix(.48,.64,orbit),mix(.68,.43,orbit));
    glowMat.opacity=opening*.35;bloom.strength=mix(.34,.15,moonPhase)+opening*.09;
    coreLight.intensity=opening*2.8;key.intensity=mix(2.8,4.0,opening);dust.rotation.z=time*.002;dust.material.opacity=.34*(1-exit);
    composer.render();
  }
  function dispose(){const geometries=new Set(),materials=new Set(),textures=new Set([moon,letters,glow,heightMap].filter(Boolean));scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());bloom.dispose();composer.dispose();env.dispose();renderer.dispose();}
  return {resize,render,dispose};
}
