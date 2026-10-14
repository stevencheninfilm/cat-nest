import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getGrowthStageById } from './growth-stages.js';

// Wide, rounded lobes and a soft point match the approved heart references.
// The lower half stays broad instead of tapering into a thin V.
function heartOutline(segments) {
  const shape = new THREE.Shape();
  shape.moveTo(0,.48);
  shape.bezierCurveTo(.25,.89,.72,1.02,.96,.60);
  shape.bezierCurveTo(1.34,.02,.59,-.67,.09,-.97);
  shape.bezierCurveTo(.03,-1.01,-.03,-1.01,-.09,-.97);
  shape.bezierCurveTo(-.59,-.67,-1.34,.02,-.96,.60);
  shape.bezierCurveTo(-.72,1.02,-.25,.89,0,.48);
  return shape.getSpacedPoints(segments).slice(0,-1);
}

/** Inflate both faces of a heart outline, sharing the rounded perimeter. */
function inflatedHeart(segments = 96, rings = 24) {
  const outline=heartOutline(segments);
  const vertices = [], faces = [];
  const add = (x, y, z) => { vertices.push(x, y, z); return vertices.length / 3 - 1; };
  const front = [[add(0, 0, .72)]];
  const back = [[add(0, 0, -.72)]];
  for (let ring = 1; ring <= rings; ring++) {
    const r = ring / rings;
    front[ring] = []; back[ring] = [];
    for (let segment = 0; segment < segments; segment++) {
      const {x,y}=outline[segment];
      const z = .72 * Math.sqrt(1 - r*r);
      front[ring][segment] = add(x*r, y*r, z);
      back[ring][segment] = ring === rings ? front[ring][segment] : add(x*r, y*r, -z);
    }
  }
  for (const [side, reverse] of [[front, true], [back, false]]) {
    const triangle = (a,b,c) => faces.push(...(reverse ? [a,c,b] : [a,b,c]));
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      triangle(side[0][0], side[1][segment], side[1][next]);
      for (let ring = 1; ring < rings; ring++) {
        triangle(side[ring][segment], side[ring+1][segment], side[ring+1][next]);
        triangle(side[ring][segment], side[ring+1][next], side[ring][next]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(faces); geometry.computeVertexNormals(); geometry.center();
  return geometry;
}

/** Reference artwork loads first. A shared 3D renderer covers failed images;
 * healthy image loads require no extra WebGL context or animation loop.
 */
export function createGrowthHeartRenderer() {
  let renderer, scene, camera, environment, smoothGeometry, gemGeometry;
  let frame = 0, lastPaint = 0, failed = false, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = new Map();
  const artworks = new Map();

  function initialize() {
    if (renderer || failed) return;
    try {
      renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, preserveDrawingBuffer:true });
      renderer.setSize(192,192,false); renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000,0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(31,1,.1,20); camera.position.set(0,0,5.05);
      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(room,.04);
      scene.environment = environment.texture;
      room.dispose(); pmrem.dispose();
      smoothGeometry = inflatedHeart();
      gemGeometry = inflatedHeart(24,4).toNonIndexed();
      gemGeometry.computeVertexNormals();
      scene.add(new THREE.HemisphereLight(0xfff9ef,0x70596a,.8));
      const key = new THREE.DirectionalLight(0xfff7ed,2.1); key.position.set(-3,4,5); scene.add(key);
      const rim = new THREE.DirectionalLight(0xe1efff,1.5); rim.position.set(4,1,-2); scene.add(rim);
    } catch {
      failed=true; renderer?.dispose(); renderer=null;
      // The dimensional SVG stays visible on devices without WebGL.
    }
  }

  function artwork(id) {
    if (artworks.has(id)) return artworks.get(id);
    const stage = getGrowthStageById(id), type = stage.material;
    const faceted = ['crystal','ruby','sapphire','diamond'].includes(type);
    const clear = ['crystal','diamond'].includes(type);
    const settings = {
      color:stage.color, roughness:.13, metalness:0, clearcoat:1,
      clearcoatRoughness:.055, ior:1.46, transmission:.06,
      thickness:.9, envMapIntensity:.9,
      attenuationColor:stage.color, attenuationDistance:3,
    };
    if (type === 'candy') Object.assign(settings, { color:0xf3b9c6, metalness:.52, roughness:.09, iridescence:1, iridescenceIOR:1.8, iridescenceThicknessRange:[200,600], envMapIntensity:1.1 });
    if (type === 'amber' || type === 'gold-amber') Object.assign(settings, { color:0xcf7b0c, transmission:.24, thickness:1.5, attenuationColor:0xd9800a, attenuationDistance:1.2, roughness:.08 });
    if (faceted) Object.assign(settings, { flatShading:true, roughness:.055, metalness:.16, ior:2.1, envMapIntensity:1.2, transmission:.1 });
    if (clear) Object.assign(settings, { color:0xf4f9fb, metalness:.1, transmission:.42, transparent:true, opacity:.68, attenuationDistance:5 });
    if (type === 'ruby') Object.assign(settings,{color:0xb60f38,metalness:.22,transmission:.16,attenuationColor:0x980b24,attenuationDistance:.7});
    if (type === 'sapphire') Object.assign(settings,{color:0x2454c6,metalness:.22,transmission:.16,attenuationColor:0x152c9a,attenuationDistance:.7});
    if (type === 'opal') Object.assign(settings, { color:0x9e79d7, iridescence:1, iridescenceIOR:1.65, iridescenceThicknessRange:[200,600], metalness:.23, roughness:.16, transmission:.08 });
    const group = new THREE.Group();
    if (faceted) {
      const points=heartOutline(96).map(point=>new THREE.Vector3(point.x*1.025,point.y*1.025+.09,.04));
      const curve=new THREE.CatmullRomCurve3(points,true);
      const bezel = new THREE.Mesh(new THREE.TubeGeometry(curve,128,type==='diamond'?.035:.025,8,true), new THREE.MeshStandardMaterial({ color:stage.edge, metalness:.8, roughness:.14 }));
      group.add(bezel);
    }
    const material = new THREE.MeshPhysicalMaterial(settings);
    group.add(new THREE.Mesh(faceted ? gemGeometry : smoothGeometry,material));
    if (type === 'gold-amber' || type === 'opal') {
      // Embedded flecks use the same inflated surface as the heart, so they
      // turn with its volume instead of floating as a screen-space texture.
      const vertices = [];
      const outline=heartOutline(97);
      for (let i=0; i<(type==='opal'?40:23); i++) {
        const point=outline[i*37%97],r=.2+((i*17%31)/31)*.63;
        const x = point.x*r, y=point.y*r+.09;
        const z = .72*Math.sqrt(1-r*r) + .025;
        const s = type === 'opal' ? .012 : .035 + (i%4)*.012;
        vertices.push(x-s,y-s*.6,z, x+s,y-s*.4,z+.005, x+s*.2,y+s,z);
      }
      const flakes = new THREE.BufferGeometry();
      flakes.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); flakes.computeVertexNormals();
      group.add(new THREE.Mesh(flakes,new THREE.MeshStandardMaterial({ color:type==='opal'?0xdcfaff:0xffe990, emissive:type==='opal'?0x72a6c7:0xc39b37, emissiveIntensity:.35, metalness:.75, roughness:.14, side:THREE.DoubleSide })));
    }
    group.visible=false; scene.add(group); artworks.set(id,group);
    return group;
  }

  function paint(time = 0) {
    frame=0;
    if (document.hidden || !targets.size || failed) return;
    initialize();
    if (!renderer) return;
    if (time - lastPaint >= 75 || reduced || !lastPaint) {
      const groups = new Map();
      for (const [canvas,context] of targets) {
        if (!canvas.isConnected) { targets.delete(canvas); continue; }
        const id = getGrowthStageById(canvas.dataset.heartStage).id;
        if (!groups.has(id)) groups.set(id,[]);
        groups.get(id).push([canvas,context]);
      }
      for (const [id, canvases] of groups) {
        const heart = artwork(id);
        heart.visible=true;
        heart.rotation.set(.06, -.28 + (reduced ? 0 : Math.sin(time / 2100)*.12), -.08);
        renderer.render(scene,camera);
        for (const [canvas,context] of canvases) {
          context.clearRect(0,0,192,192);
          context.drawImage(renderer.domElement,0,0);
          canvas.classList.add('is-ready');
        }
        heart.visible=false;
      }
      lastPaint=time;
    }
    if (!reduced && targets.size) frame=requestAnimationFrame(paint);
  }

  function scan() {
    targets.clear();
    for (const image of document.querySelectorAll('.growth-heart-art')) {
      image.parentElement.classList.toggle('has-artwork',image.complete && image.naturalWidth>0);
    }
    for (const canvas of document.querySelectorAll('.growth-heart-canvas')) {
      if (!canvas.getClientRects().length) continue;
      const image = canvas.parentElement.querySelector('.growth-heart-art');
      if (image && (!image.complete || image.naturalWidth>0)) continue;
      const rect = canvas.getBoundingClientRect();
      if (rect.bottom<0 || rect.top>innerHeight || rect.right<0 || rect.left>innerWidth) continue;
      const context = canvas.getContext('2d');
      if (context) targets.set(canvas,context);
    }
    if (!frame && targets.size && !document.hidden) frame=requestAnimationFrame(paint);
    if (!targets.size && frame) { cancelAnimationFrame(frame); frame=0; }
  }
  let scanScheduled=false;
  const observer = new MutationObserver(() => {
    if (scanScheduled) return;
    scanScheduled=true;
    queueMicrotask(() => { scanScheduled=false; scan(); });
  });
  observer.observe(document.body,{ childList:true, subtree:true });
  // Dialog visibility can change without replacing its contents.
  const dialogs = new MutationObserver(scan);
  for (const dialog of document.querySelectorAll('dialog')) dialogs.observe(dialog,{attributes:true,attributeFilter:['open']});
  function pause() { cancelAnimationFrame(frame); frame=0; }
  function resume() { scan(); }
  function motionChanged(event) { reduced=event.matches; pause(); scan(); }
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change',motionChanged);
  function visibilityChanged() { document.hidden ? pause() : resume(); }
  function imageSettled(event) { if (event.target.matches?.('.growth-heart-art')) scan(); }
  document.addEventListener('load',imageSettled,true); document.addEventListener('error',imageSettled,true);
  document.addEventListener('visibilitychange',visibilityChanged);
  document.addEventListener('scroll',scan,true);
  window.addEventListener('resize',scan);
  window.addEventListener('pagehide',pause); window.addEventListener('pageshow',resume);
  scan();
  return { dispose() {
    pause(); observer.disconnect(); dialogs.disconnect(); preference.removeEventListener('change',motionChanged);
    document.removeEventListener('visibilitychange',visibilityChanged); document.removeEventListener('scroll',scan,true);
    document.removeEventListener('load',imageSettled,true); document.removeEventListener('error',imageSettled,true);
    window.removeEventListener('resize',scan); window.removeEventListener('pagehide',pause); window.removeEventListener('pageshow',resume);
    for (const group of artworks.values()) group.traverse(child => { child.material?.dispose(); if (child.isMesh && child.geometry!==smoothGeometry && child.geometry!==gemGeometry) child.geometry.dispose(); });
    environment?.dispose(); smoothGeometry?.dispose(); gemGeometry?.dispose(); renderer?.dispose();
  } };
}
