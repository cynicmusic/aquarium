/**
 * ChromatoPlayground.js — debug viewer that shows each skin layer in isolation.
 *
 *   Leukophore only     | Iridophore only     | Warm chromatophore only | Cool chromatophore only
 *   Zebra only          | Sparkle only        | Expansion wave (heatmap)| Composite (all layers)
 *   Dorsal mask         | Head reticulation   | Propagation arrows      | Reference side-by-side
 *
 * Each tile uses a version of the chromatophore shader where every layer except
 * the named one is suppressed. That makes it trivial to see WHICH layer isn't
 * propagating / shimmering / matching reference.
 */

import * as THREE from 'three';

const LAYERS = [
  { name: 'LEUKOPHORE only',            mode: 1 },
  { name: 'IRIDOPHORE only',            mode: 2 },
  { name: 'WARM CHROMATOPHORE only',    mode: 3 },
  { name: 'COOL CHROMATOPHORE only',    mode: 4 },
  { name: 'ZEBRA only',                 mode: 5 },
  { name: 'SPARKLE only',               mode: 6 },
  { name: 'EXPANSION WAVE (heatmap)',   mode: 7 },
  { name: 'DORSAL region mask',         mode: 8 },
  { name: 'HEAD reticulation mask',     mode: 9 },
  { name: 'WARM + COOL chromatophores', mode: 10 },
  { name: 'LEUKO + IRIDO + ZEBRA',      mode: 11 },
  { name: 'FULL COMPOSITE',             mode: 0 },
];

const vertex = /* glsl */`
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */`
precision highp float;
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
uniform float uTime;
uniform int   uMode;

// Include the same layer functions as ChromatophoreMaterial (minimal port).

vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float hash21(vec2 p){vec2 q=fract(p*vec2(123.34,345.56));q+=dot(q,q+34.56);return fract(q.x*q.y);}
float vnoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p,int oct){float v=0.0,a=0.5;for(int i=0;i<6;i++){if(i>=oct)break;v+=vnoise(p)*a;p*=2.02;a*=0.5;}return v;}

float expansionWave(vec2 uv,float t){
  float w=0.0;
  w+=0.4*sin(length(uv-vec2(0.5))*8.0-t*0.6);
  w+=0.3*sin(uv.x*4.0+uv.y*3.0-t*0.8);
  w+=0.3*sin(fbm(uv*3.0+t*0.15,2)*6.28+t*0.5);
  return w*0.5+0.5;
}

vec3 voronoi(vec2 uv,float density,float t){
  vec2 id=floor(uv*density),fd=fract(uv*density);
  float minD=10.0,cellId=0.0;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
    vec2 off=vec2(float(x),float(y)),cp=id+off;
    vec2 pt=hash22(cp);
    float ch=hash21(cp+0.5);
    pt+=0.05*vec2(sin(t*0.4+ch*30.0),cos(t*0.35+ch*25.0));
    float waveProxy=sin((cp.x+cp.y)*0.3+t*0.15+sin(t*0.08+ch*5.0)*2.0);
    float kick=max(waveProxy,0.0);kick*=kick;
    float sp=t*2.0+ch*40.0;
    float spring=sin(sp)*exp(-fract(sp/6.28)*2.0);
    pt+=kick*spring*0.1*vec2(cos(ch*6.28+waveProxy*1.5),sin(ch*6.28+waveProxy*1.5));
    vec2 d=off+pt-fd;float dist=length(d);
    if(dist<minD){minD=dist;cellId=hash21(cp);}
  }
  return vec3(minD,cellId,0.0);
}

vec3 leukophore(vec2 uv,float t){
  return vec3(0.82,0.78,0.70)*(0.88+0.14*fbm(uv*2.2+vec2(t*0.04,t*0.02),3));
}

vec3 iridophore(vec2 uv,vec3 n,vec3 v,float t){
  float a1=t*0.06+sin(t*0.09)*0.5,a2=t*0.042-sin(t*0.07)*0.6;
  vec2 d1=vec2(cos(a1),sin(a1)),d2=vec2(cos(a2),sin(a2));
  float p=dot(uv,d1)*11.0+dot(uv,d2)*8.5+fbm(uv*5.0+t*0.1,2)*3.0+t*0.4;
  vec3 sp=vec3(0.5+0.5*sin(p+3.14159),0.5+0.5*sin(p-2.094),0.5+0.5*sin(p));
  float fr=pow(1.0-max(dot(normalize(n),normalize(v)),0.0),1.2);
  float patchN=smoothstep(0.25,0.85,fbm(uv*9.0+t*0.08,3));
  return sp*fr*patchN;
}

vec4 chromaWarm(vec2 uv,float t,float ex){
  vec3 vor=voronoi(uv,46.0,t);
  float p=vor.y*6.28;
  float expand=clamp(ex+sin(t*1.2+p)*0.3,0.0,1.0);
  float r=mix(0.10,0.42,expand);
  float m=smoothstep(r+0.04,r-0.04,vor.x);
  vec3 c=vor.y<0.33?vec3(0.75,0.15,0.05):(vor.y<0.66?vec3(0.85,0.55,0.05):vec3(0.35,0.08,0.02));
  return vec4(c*(0.75+0.25*smoothstep(0.0,0.3,vor.x/max(r,0.01))),m);
}

vec4 chromaCool(vec2 uv,float t,float ex){
  vec3 vor=voronoi(uv+0.37,30.0,t*0.8);
  float expand=clamp(1.0-ex+sin(t*0.9+vor.y*6.28)*0.2,0.0,1.0);
  float r=mix(0.06,0.55,expand);
  float m=smoothstep(r+0.05,r-0.03,vor.x);
  vec3 c=vor.y<0.33?vec3(0.05,0.55,0.75):(vor.y<0.66?vec3(0.10,0.35,0.85):vec3(0.02,0.25,0.50));
  return vec4(c,m);
}

float zebra(vec2 uv,float t){
  float dU=smoothstep(0.32,0.46,uv.x)*(1.0-smoothstep(0.54,0.68,uv.x));
  float dV=smoothstep(0.18,0.35,uv.y)*(1.0-smoothstep(0.80,0.96,uv.y));
  float dorsalW=dU*dV;
  vec2 q=uv*vec2(6.0,12.0)+t*0.02;
  float w1=fbm(q,4),w2=fbm(q*2.3+w1*4.0,4),w3=fbm(q*0.7+vec2(w2*6.0,w1*4.0),3);
  float warp=(w1*0.5+w2*0.35+w3*0.25)-0.55;
  float phase=uv.y*11.0+warp*1.4;
  float raw=0.5+0.5*sin(phase*6.2832);
  float phase2=uv.y*11.0*1.7+warp*2.0+sin(uv.x*30.0)*0.3;
  float raw2=0.5+0.5*sin(phase2*6.2832);
  float comb=max(raw,raw2*0.55);
  comb*=smoothstep(0.30,0.80,fbm(uv*vec2(20.0,40.0)+warp*2.0,3));
  float stripes=pow(comb,6.0);
  float dorsal=stripes*dorsalW;
  float headV=1.0-smoothstep(0.20,0.34,uv.y);
  float head=smoothstep(0.58,0.78,fbm(uv*28.0+t*0.01,4))*headV*0.75;
  return clamp(dorsal+head,0.0,1.0);
}

float dorsalMask(vec2 uv){
  float dU=smoothstep(0.32,0.46,uv.x)*(1.0-smoothstep(0.54,0.68,uv.x));
  float dV=smoothstep(0.18,0.35,uv.y)*(1.0-smoothstep(0.80,0.96,uv.y));
  return dU*dV;
}
float headMask(vec2 uv){
  return (1.0-smoothstep(0.20,0.34,uv.y))*smoothstep(0.58,0.78,fbm(uv*28.0,4));
}

float sparkle(vec2 uv,float t){
  vec2 id=floor(uv*80.0);vec2 fd=fract(uv*80.0);
  float ch=hash21(id);
  float d=length(hash22(id)-fd);
  float fl=smoothstep(0.92,1.0,sin(t*3.0+ch*40.0)*0.5+0.5);
  return smoothstep(0.15,0.0,d)*fl*ch;
}

void main(){
  vec2 uv=vUv;float t=uTime;
  float ex=expansionWave(uv,t);
  vec3 col=vec3(0.0);
  if(uMode==0){
    col=leukophore(uv,t);
    col+=iridophore(uv,vWorldNormal,vViewDir,t)*0.55;
    vec4 w=chromaWarm(uv,t,ex);col=mix(col,w.rgb,w.a);
    vec4 c=chromaCool(uv,t,ex);col=1.0-(1.0-col)*(1.0-c.rgb*c.a);
    float z=zebra(uv,t);col=mix(col,vec3(0.08,0.05,0.03),z*0.88);
    col+=vec3(1.0)*sparkle(uv,t)*0.8;
  }
  else if(uMode==1) col=leukophore(uv,t);
  else if(uMode==2) col=iridophore(uv,vWorldNormal,vViewDir,t);
  else if(uMode==3){vec4 w=chromaWarm(uv,t,ex);col=w.rgb*w.a;}
  else if(uMode==4){vec4 c=chromaCool(uv,t,ex);col=c.rgb*c.a;}
  else if(uMode==5){float z=zebra(uv,t);col=vec3(z*0.95);}
  else if(uMode==6) col=vec3(sparkle(uv,t));
  else if(uMode==7){
    // Heatmap: expansion wave visualised with viridis-like colour ramp
    float v=ex;
    col=mix(vec3(0.0,0.0,0.3),vec3(1.0,0.8,0.0),v);
    col=mix(col,vec3(1.0,1.0,1.0),smoothstep(0.8,1.0,v));
  }
  else if(uMode==8) col=vec3(dorsalMask(uv));
  else if(uMode==9) col=vec3(headMask(uv));
  else if(uMode==10){
    vec4 w=chromaWarm(uv,t,ex);vec4 c=chromaCool(uv,t,ex);
    col=vec3(0.15);col=mix(col,w.rgb,w.a);col=1.0-(1.0-col)*(1.0-c.rgb*c.a);
  }
  else if(uMode==11){
    col=leukophore(uv,t);
    col+=iridophore(uv,vWorldNormal,vViewDir,t)*0.6;
    float z=zebra(uv,t);col=mix(col,vec3(0.08,0.05,0.03),z*0.9);
  }
  gl_FragColor=vec4(col,1.0);
}
`;

const grid = document.getElementById('grid');
const mats = [];
for (const layer of LAYERS) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  const canvas = document.createElement('canvas');
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.innerHTML = `<b>${layer.mode}</b> ${layer.name}`;
  cell.appendChild(canvas); cell.appendChild(lbl);
  grid.appendChild(cell);

  const W = 560, H = 400;
  canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x0a0b14);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 0.7, -0.7, -1, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment,
    uniforms: { uTime: { value: 0 }, uMode: { value: layer.mode } },
    side: THREE.DoubleSide,
  });
  mats.push(mat);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.4), mat);
  scene.add(mesh);
  cell._r = { renderer, scene, cam, mat };
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();
  for (const mat of mats) mat.uniforms.uTime.value = t;
  for (const cell of grid.children) {
    cell._r.renderer.render(cell._r.scene, cell._r.cam);
  }
}
loop();
