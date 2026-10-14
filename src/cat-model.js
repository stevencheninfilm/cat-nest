import * as THREE from 'three';
import { createCatMotion } from './cat-motion.js';

/**
 * A locally built, articulated plush kitten. No remote model, textures or tracking.
 * consumeTap() returns true after a rotate gesture, so a button can suppress its click.
 */
export function createCatModel({ container, onReady, onError, reducedMotion = false } = {}) {
  const motion = createCatMotion({ reducedMotion });
  let renderer;
  let destroyed = false;
  let failed = false;
  let paused = false;
  let frame = 0;
  let lastFrame = 0;
  let animateUntil = 0;
  let ready = false;
  let lastSleeping = false;
  let didDrag = false;
  let pointer = null;
  let targetYaw = 0;
  let yaw = 0;
  let observer;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const disposers = [];
  const listen = (node, type, handler, options) => {
    node.addEventListener(type, handler, options);
    disposers.push(() => node.removeEventListener(type, handler, options));
  };
  const api = {
    react(type, state) {
      motion.react(type, state);
      const action = typeof type === 'object' ? type?.type : type;
      if (typeof state?.sleeping === 'boolean') lastSleeping = state.sleeping;
      else if (action === 'sleep') lastSleeping = !lastSleeping;
      else if (['pet', 'play', 'feed', 'wave', 'dance'].includes(action)) lastSleeping = false;
      wake(4.5);
    },
    setState(state) {
      motion.setState(state);
      if (typeof state?.sleeping === 'boolean' && state.sleeping !== lastSleeping) {
        lastSleeping = state.sleeping;
        wake(2.1);
      }
    },
    setPaused(value) {
      paused = Boolean(value);
      if (paused) { cancelAnimationFrame(frame); frame = 0; }
      else { lastFrame = 0; wake(1.5); }
    },
    consumeTap() { const consumed = didDrag; didDrag = false; return consumed; },
    resetView() { targetYaw = 0; wake(1.5); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      for (const dispose of disposers) dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
      container?.classList.remove('has-cat-model');
    },
  };
  function fail(error) {
    failed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    if (renderer) renderer.domElement.style.display = 'none';
    container?.classList.remove('has-cat-model');
    onError?.(error);
  }
  if (!container) { onError?.(new Error('A kitten container is required')); return api; }

  let scene, camera, avatar, head, body, leftLeg, rightLeg, leftEar, rightEar, tail;
  let eyeGroups, closedEyes, mouth, tongue, toy, sleepy, shadow, tailGeometry;
  let headFur, bodyFur;
  const tailPoints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const tailCurve = new THREE.CatmullRomCurve3(tailPoints);
  const tailSegments = 32;
  const tailSides = 12;
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const point = new THREE.Vector3();

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.className = 'cat-model-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    container.append(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-2.1, 2.1, 2.1, -2.1, 0.1, 40);
    camera.position.set(0, 2.15, 8);
    camera.lookAt(0, 1.78, 0);
    scene.add(new THREE.HemisphereLight(0xfff8eb, 0xa26b4a, 1.9));
    const key = new THREE.DirectionalLight(0xfff2d9, 3.0);
    key.position.set(-3, 5, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1.35);
    fill.position.set(4, 2.5, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffdfb0, 2.3);
    rim.position.set(1, 4, -4); scene.add(rim);

    const sphere = geometry(new THREE.SphereGeometry(1, 36, 26));
    const smallSphere = geometry(new THREE.SphereGeometry(1, 20, 14));
    const tuftGeometry = geometry(new THREE.SphereGeometry(1, 8, 6));
    const coat = material(new THREE.MeshStandardMaterial({ color: 0xe6a15f, roughness: 0.9 }));
    const cream = material(new THREE.MeshStandardMaterial({ color: 0xffe9c8, roughness: 0.92 }));
    const orange = material(new THREE.MeshStandardMaterial({ color: 0xc77e43, roughness: 0.95 }));
    const pink = material(new THREE.MeshStandardMaterial({ color: 0xeaa9a3, roughness: 0.8 }));
    const innerPink = material(new THREE.MeshStandardMaterial({ color: 0xe7a1a0, roughness: 0.86 }));
    const brown = material(new THREE.MeshStandardMaterial({ color: 0x6f4532, roughness: 0.8 }));
    const noseMat = material(new THREE.MeshPhongMaterial({ color: 0xc9807c, specular: 0xffe7d5, shininess: 55 }));
    const gold = material(new THREE.MeshStandardMaterial({ color: 0xe5aa48, roughness: 0.32, metalness: 0.5 }));
    const mint = material(new THREE.MeshStandardMaterial({ color: 0x9bb9a5, roughness: 0.78 }));
    const darkEye = material(new THREE.MeshPhongMaterial({ color: 0x301c17, specular: 0x9d755a, shininess: 110 }));
    const irisMat = material(new THREE.MeshPhongMaterial({ color: 0x855222, specular: 0xffe2b4, shininess: 90 }));
    const pupilMat = material(new THREE.MeshPhongMaterial({ color: 0x17131a, specular: 0x605459, shininess: 130 }));
    const white = material(new THREE.MeshBasicMaterial({ color: 0xfffbf1 }));
    const whiskerMat = material(new THREE.MeshStandardMaterial({ color: 0xffecd0, roughness: 0.75, transparent: true, opacity: 0.85 }));

    avatar = new THREE.Group(); scene.add(avatar);
    body = new THREE.Group(); body.position.y = 1.1; avatar.add(body);
    ellipsoid(body, coat, [0, 0, 0], [0.77, 0.96, 0.64]);
    ellipsoid(body, cream, [0, -0.1, 0.46], [0.52, 0.7, 0.25]);
    // The haunches give the seated kitten its feline silhouette.
    ellipsoid(avatar, coat, [-0.57, 0.56, -0.05], [0.49, 0.56, 0.51]);
    ellipsoid(avatar, coat, [0.57, 0.56, -0.05], [0.49, 0.56, 0.51]);
    ellipsoid(avatar, cream, [-0.65, 0.19, 0.22], [0.4, 0.23, 0.48]);
    ellipsoid(avatar, cream, [0.65, 0.19, 0.22], [0.4, 0.23, 0.48]);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const stripe = ellipsoid(body, orange, [side * (0.64 - i * 0.035), 0.21 - i * 0.21, 0.25], [0.075, 0.065, 0.32]);
        stripe.rotation.z = side * 0.25;
      }
    }
    bodyFur = fur(body, [0, 0, 0], [0.77, 0.96, 0.64], coat, 150, 21, tuftGeometry);

    leftLeg = leg(-1); rightLeg = leg(1);
    const collarGeometry = geometry(new THREE.TorusGeometry(0.5, 0.052, 10, 42));
    const collar = new THREE.Mesh(collarGeometry, mint);
    collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.58, 0.04); body.add(collar);
    const bell = ellipsoid(body, gold, [0, 0.43, 0.64], [0.115, 0.13, 0.095]);
    tube(bell, [[-0.07, 0, 0.085], [0, -0.015, 0.096], [0.07, 0, 0.085]], 0.009, brown);
    ellipsoid(bell, brown, [0, -0.035, 0.09], [0.024, 0.024, 0.014], smallSphere);

    head = new THREE.Group(); head.position.set(0, 2.38, 0.13); head.scale.x = 1.05; avatar.add(head);
    ellipsoid(head, coat, [0, 0, 0], [1.13, 0.99, 0.86]);
    // Soft cheek ruffs, cream eye surrounds and a round double muzzle.
    ellipsoid(head, cream, [-0.75, -0.33, 0.4], [0.44, 0.39, 0.38]);
    ellipsoid(head, cream, [0.75, -0.33, 0.4], [0.44, 0.39, 0.38]);
    ellipsoid(head, cream, [-0.43, 0.08, 0.66], [0.47, 0.48, 0.22]);
    ellipsoid(head, cream, [0.43, 0.08, 0.66], [0.47, 0.48, 0.22]);
    ellipsoid(head, cream, [0, -0.49, 0.69], [0.48, 0.27, 0.3]);
    ellipsoid(head, cream, [-0.23, -0.3, 0.82], [0.31, 0.25, 0.25]);
    ellipsoid(head, cream, [0.23, -0.3, 0.82], [0.31, 0.25, 0.25]);
    headFur = fur(head, [0, 0, 0], [1.13, 0.99, 0.86], coat, 240, 47, tuftGeometry);
    fur(head, [-0.76, -0.32, 0.4], [0.39, 0.35, 0.35], cream, 55, 62, tuftGeometry);
    fur(head, [0.76, -0.32, 0.4], [0.39, 0.35, 0.35], cream, 55, 63, tuftGeometry);

    leftEar = ear(-1); rightEar = ear(1);
    // Curved tabby forehead markings sit on the surface, including the characteristic M.
    for (const side of [-1, 1]) {
      tube(head, [[side * 0.11, 0.74, 0.55], [side * 0.17, 0.61, 0.69], [side * 0.23, 0.46, 0.78]], 0.055, orange);
      tube(head, [[side * 0.41, 0.73, 0.5], [side * 0.43, 0.62, 0.65], [side * 0.4, 0.52, 0.73]], 0.046, orange);
      tube(head, [[side * 0.94, 0.02, 0.47], [side * 0.87, -0.02, 0.61], [side * 0.82, -0.1, 0.66]], 0.046, orange);
      tube(head, [[side * 0.99, -0.19, 0.42], [side * 0.92, -0.2, 0.55], [side * 0.86, -0.24, 0.62]], 0.035, orange);
    }
    eyeGroups = []; closedEyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(side * 0.44, 0.08, 0.82); eye.rotation.y = side * 0.13; head.add(eye);
      ellipsoid(eye, brown, [0, 0, -0.015], [0.335, 0.385, 0.13]);
      const open = new THREE.Group(); eye.add(open); eyeGroups.push(open);
      ellipsoid(open, darkEye, [0, 0, 0.015], [0.303, 0.354, 0.13]);
      ellipsoid(open, irisMat, [0, -0.02, 0.117], [0.245, 0.277, 0.055]);
      ellipsoid(open, pupilMat, [-side * 0.015, 0.018, 0.162], [0.176, 0.235, 0.043]);
      ellipsoid(open, white, [-0.09, 0.135, 0.193], [0.081, 0.08, 0.026], smallSphere);
      ellipsoid(open, white, [0.098, -0.09, 0.193], [0.031, 0.032, 0.017], smallSphere);
      const closed = new THREE.Group(); closed.visible = false; eye.add(closed); closedEyes.push(closed);
      // Cream lids cover the eye backing while a gently upturned line makes a sleepy smile.
      ellipsoid(closed, cream, [0, 0, 0.018], [0.35, 0.4, 0.14]);
      tube(closed, [[-0.25, -0.012, 0.145], [-0.12, 0.065, 0.169], [0, 0.086, 0.176], [0.12, 0.065, 0.169], [0.25, -0.012, 0.145]], 0.021, brown);
      tube(head, [[side * 0.25, 0.48, 0.72], [side * 0.43, 0.51, 0.75], [side * 0.6, 0.47, 0.69]], 0.03, cream);
    }
    // Rounded triangular pink nose, the split upper lip and a small smile.
    const noseShape = new THREE.Shape();
    noseShape.moveTo(-0.13, 0.04);
    noseShape.quadraticCurveTo(-0.15, 0.11, -0.06, 0.115);
    noseShape.quadraticCurveTo(0, 0.09, 0.06, 0.115);
    noseShape.quadraticCurveTo(0.15, 0.11, 0.13, 0.04);
    noseShape.quadraticCurveTo(0.07, -0.07, 0, -0.09);
    noseShape.quadraticCurveTo(-0.07, -0.07, -0.13, 0.04);
    const noseGeometry = geometry(new THREE.ExtrudeGeometry(noseShape, { depth: 0.04, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 12 }));
    const nose = new THREE.Mesh(noseGeometry, noseMat); nose.position.set(0, -0.27, 1.045); head.add(nose);
    ellipsoid(head, pink, [-0.64, -0.26, 0.78], [0.15, 0.075, 0.027], smallSphere);
    ellipsoid(head, pink, [0.64, -0.26, 0.78], [0.15, 0.075, 0.027], smallSphere);
    mouth = new THREE.Group(); mouth.position.set(0, -0.39, 1.015); head.add(mouth);
    tube(mouth, [[0, 0.035, 0.02], [0, -0.035, 0.03]], 0.016, brown);
    tube(mouth, [[0, -0.025, 0.03], [-0.07, -0.08, 0.02], [-0.16, -0.065, -0.008]], 0.016, brown);
    tube(mouth, [[0, -0.025, 0.03], [0.07, -0.08, 0.02], [0.16, -0.065, -0.008]], 0.016, brown);
    tongue = ellipsoid(mouth, pink, [0, -0.09, 0.012], [0.07, 0.07, 0.025], smallSphere); tongue.visible = false;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        tube(head, [[side * 0.48, -0.35 - i * 0.095, 0.91], [side * 0.83, -0.28 - i * 0.16, 0.89], [side * 1.22, -0.24 - i * 0.23, 0.77]], 0.009, whiskerMat);
        ellipsoid(head, brown, [side * (0.35 + i * 0.09), -0.33 - i * 0.055, 1.032 - i * 0.02], [0.013, 0.013, 0.008], smallSphere);
      }
    }

    tailGeometry = geometry(new THREE.BufferGeometry());
    const positions = new Float32Array((tailSegments + 1) * (tailSides + 1) * 3);
    const colors = new Float32Array(positions.length);
    const indices = [];
    const colorA = new THREE.Color(0xe6a15f), colorB = new THREE.Color(0xbb783f), colorTip = new THREE.Color(0xffe9c8);
    for (let i = 0; i <= tailSegments; i++) {
      const t = i / tailSegments;
      const color = t > 0.87 ? colorTip : (Math.floor(t * 7) % 2 === 1 ? colorB : colorA);
      for (let j = 0; j <= tailSides; j++) {
        const n = (i * (tailSides + 1) + j) * 3;
        colors[n] = color.r; colors[n + 1] = color.g; colors[n + 2] = color.b;
        if (i < tailSegments && j < tailSides) {
          const a = i * (tailSides + 1) + j, b = a + tailSides + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    tailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    tailGeometry.setIndex(indices);
    tail = new THREE.Mesh(tailGeometry, material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide })));
    tail.renderOrder = -1; avatar.add(tail);

    toy = new THREE.Group(); scene.add(toy); toy.visible = false;
    ellipsoid(toy, pink, [0, 0, 0], [0.15, 0.15, 0.15], smallSphere);
    const toyRing = new THREE.Mesh(geometry(new THREE.TorusGeometry(0.151, 0.013, 6, 24)), cream); toy.add(toyRing);
    toyRing.rotation.y = 0.6;
    sleepy = new THREE.Group(); scene.add(sleepy); sleepy.visible = false;
    for (let i = 0; i < 3; i++) {
      const sprite = textSprite('z', '#a68465');
      sprite.scale.setScalar(0.24 + i * 0.07); sprite.position.set(i * 0.24, i * 0.28, 0); sleepy.add(sprite);
    }
    shadow = shadowPlane(); shadow.position.set(0, 0.01, 0.06); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

    observer = new ResizeObserver(resize); observer.observe(container); resize();
    listen(renderer.domElement, 'webglcontextlost', event => { event.preventDefault(); fail(new Error('The kitten graphics context was interrupted')); });
    listen(renderer.domElement, 'webglcontextrestored', () => { failed = false; ready = false; renderer.domElement.style.display = ''; resize(); wake(2); });
    listen(container, 'pointerdown', event => {
      if (event.button !== 0 || (pointer && pointer.id !== event.pointerId)) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, horizontal: false };
      didDrag = false;
    });
    listen(container, 'pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      if (!pointer.horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        pointer.horizontal = true; didDrag = true;
        try { container.setPointerCapture(event.pointerId); } catch { /* Pointer may have already been cancelled. */ }
      }
      if (pointer.horizontal) {
        event.preventDefault();
        targetYaw += (event.clientX - pointer.lastX) * 0.012;
        wake(1.5);
      }
      pointer.lastX = event.clientX;
    }, { passive: false });
    const endPointer = event => {
      if (pointer?.id !== event.pointerId) return;
      try { if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId); } catch { /* No active capture. */ }
      pointer = null;
    };
    listen(container, 'pointerup', endPointer);
    listen(container, 'pointercancel', endPointer);
    wake(2);
  } catch (error) {
    fail(error);
    renderer?.domElement.remove();
  }
  return api;

  function geometry(value) { geometries.add(value); return value; }
  function material(value) { materials.add(value); return value; }
  function ellipsoid(parent, mat, position, scale, shape) {
    // Sphere geometry is shared by nearly every part, so the model stays small on mobile.
    const mesh = new THREE.Mesh(shape || [...geometries][0], mat);
    mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }
  function tube(parent, coords, radius, mat) {
    const curve = new THREE.CatmullRomCurve3(coords.map(v => new THREE.Vector3(...v)));
    const mesh = new THREE.Mesh(geometry(new THREE.TubeGeometry(curve, Math.max(8, coords.length * 5), radius, 7, false)), mat);
    parent.add(mesh); return mesh;
  }
  function leg(side) {
    const group = new THREE.Group(); group.position.set(side * 0.35, 1.23, 0.38); avatar.add(group);
    const coat = [...materials][0], cream = [...materials][1];
    ellipsoid(group, coat, [0, -0.31, 0], [0.25, 0.43, 0.27]);
    ellipsoid(group, cream, [0, -0.71, 0.04], [0.24, 0.34, 0.27]);
    ellipsoid(group, cream, [0, -0.98, 0.17], [0.31, 0.21, 0.39]);
    const toeMat = material(new THREE.MeshStandardMaterial({ color: 0xd6bb9a, roughness: 0.9 }));
    for (const x of [-0.105, 0.105]) tube(group, [[x, -0.98, 0.49], [x, -1.04, 0.5]], 0.009, toeMat);
    return group;
  }
  function ear(side) {
    const group = new THREE.Group(); group.position.set(side * 0.77, 0.65, -0.01); group.rotation.z = side * -0.16; group.scale.y = 0.85; head.add(group);
    const shape = new THREE.Shape();
    shape.moveTo(-0.4, -0.25);
    shape.bezierCurveTo(-0.44, 0.02, -0.28, 0.61, -0.13, 0.7);
    shape.bezierCurveTo(0.015, 0.76, 0.36, 0.17, 0.42, -0.25);
    shape.quadraticCurveTo(0, -0.46, -0.4, -0.25);
    const outer = new THREE.Mesh(geometry(new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.085, bevelThickness: 0.09, curveSegments: 14 })), [...materials][0]);
    outer.position.z = -0.1; group.add(outer);
    const inner = new THREE.Mesh(geometry(new THREE.ShapeGeometry(shape, 20)), [...materials][4]);
    inner.scale.set(0.66, 0.68, 1); inner.position.set(0, 0.015, 0.132); group.add(inner);
    const down = ellipsoid(group, [...materials][1], [0, -0.2, 0.16], [0.24, 0.1, 0.08]); down.rotation.z = -side * 0.1;
    return group;
  }
  function fur(parent, center, radii, mat, count, seed, sphere) {
    // Short, sparse plush tufts soften the outline without a hair shader or external texture.
    const tuft = new THREE.InstancedMesh(sphere, mat, count);
    const dummy = new THREE.Object3D();
    let randomSeed = seed;
    const random = () => { randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0; return randomSeed / 4294967296; };
    for (let i = 0; i < count; i++) {
      const azimuth = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const r = Math.sqrt(1 - y * y);
      const direction = new THREE.Vector3(Math.cos(azimuth) * r, y, Math.sin(azimuth) * r);
      // Keep the front of the face smooth. The sides retain a soft little ruff.
      if (direction.z > 0.08) direction.z *= -1;
      dummy.position.set(center[0] + direction.x * radii[0] * 0.99, center[1] + direction.y * radii[1] * 0.99, center[2] + direction.z * radii[2] * 0.99);
      dummy.quaternion.setFromUnitVectors(up, direction.normalize());
      dummy.scale.set(0.025 + random() * 0.012, 0.035 + random() * 0.027, 0.025 + random() * 0.012);
      dummy.updateMatrix(); tuft.setMatrixAt(i, dummy.matrix);
    }
    parent.add(tuft); return tuft;
  }
  function textSprite(text, color) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = color; context.font = 'bold 100px Georgia'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 64, 61);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    return new THREE.Sprite(material(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })));
  }
  function shadowPlane() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(107,65,33,0.24)'); gradient.addColorStop(0.55, 'rgba(107,65,33,0.12)'); gradient.addColorStop(1, 'rgba(107,65,33,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas); textures.add(texture);
    const plane = new THREE.Mesh(geometry(new THREE.PlaneGeometry(3.2, 2.2)), material(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })));
    return plane;
  }
  function resize() {
    if (destroyed || failed || !renderer || !camera) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    const aspect = width / height;
    const halfHeight = aspect < 0.8 ? 1.98 / aspect * 0.8 : 1.98;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); wake(0.5);
  }
  function wake(seconds = 1.5) {
    animateUntil = Math.max(animateUntil, performance.now() + seconds * 1000);
    if (!destroyed && !failed && !paused && renderer && !frame) frame = requestAnimationFrame(animate);
  }
  function updateTail(pose) {
    const curl = pose.sleep;
    tailPoints[0].set(0.46, 0.5, -0.48);
    tailPoints[1].set(1.05, 0.48 - curl * 0.15, -0.35);
    tailPoints[2].set(1.34, 0.72 - curl * 0.32, pose.tail);
    tailPoints[3].set(1.38 - curl * 0.22, 1.13 - curl * 0.72, 0.1 + pose.tail + curl * 0.5);
    tailPoints[4].set(1.2 - curl * 0.5, 1.48 - curl * 1.12, 0.16 + pose.tail * 1.5 + curl * 0.85);
    const values = tailGeometry.attributes.position.array;
    for (let i = 0; i <= tailSegments; i++) {
      const t = i / tailSegments;
      tailCurve.getPoint(t, point); tailCurve.getTangent(t, tangent).normalize();
      normal.set(0, 0, 1).cross(tangent).normalize();
      binormal.copy(tangent).cross(normal).normalize();
      const radius = 0.174 * (1 - t * 0.26) * Math.min(1, (1 - t) * 14 + 0.045);
      for (let j = 0; j <= tailSides; j++) {
        const angle = j / tailSides * Math.PI * 2;
        const n = (i * (tailSides + 1) + j) * 3;
        const a = Math.cos(angle) * radius, b = Math.sin(angle) * radius;
        values[n] = point.x + normal.x * a + binormal.x * b;
        values[n + 1] = point.y + normal.y * a + binormal.y * b;
        values[n + 2] = point.z + normal.z * a + binormal.z * b;
      }
    }
    tailGeometry.attributes.position.needsUpdate = true;
    tailGeometry.computeVertexNormals();
    // The silhouette changes while curling, so avoid stale auto-calculated bounds.
    tail.frustumCulled = false;
  }
  function animate(now) {
    frame = 0;
    if (destroyed || failed || paused) return;
    if (lastFrame && now - lastFrame < 1000 / 30) { frame = requestAnimationFrame(animate); return; }
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 1 / 30;
    lastFrame = now;
    const pose = motion.advance(dt), s = pose.sleep;
    yaw += (targetYaw - yaw) * (1 - Math.exp(-dt * 13));
    avatar.rotation.set(0, yaw, pose.sway);
    avatar.position.y = pose.hop;
    body.position.set(-s * 0.12, 1.1 - s * 0.3, 0);
    body.scale.set(1.15 + s * 0.18 + pose.breath, 1 - s * 0.2 + pose.breath, 1 + pose.breath);
    body.rotation.z = s * 0.2;
    head.position.set(s * 0.47, 2.38 - s * 1.31 + pose.breath * 1.3, 0.13 + s * 0.37);
    head.rotation.set(pose.headPitch + s * 0.05, pose.headYaw * (1 - s), pose.headTilt - s * 0.48);
    leftEar.rotation.z = 0.16 + pose.earTwitch + s * 0.09;
    rightEar.rotation.z = -0.16 - pose.earTwitch * 0.55 - s * 0.09;
    leftLeg.position.set(-0.35 - s * 0.08, 1.23 - s * 0.65, 0.38);
    rightLeg.position.set(0.35 + s * 0.08, 1.23 - s * 0.65, 0.38);
    leftLeg.rotation.set(-s * 0.92 - pose.leftPaw * 1.15, 0, -pose.leftPaw * 0.5);
    rightLeg.rotation.set(-s * 0.92 - pose.rightPaw * 1.15, 0, pose.rightPaw * 0.5);
    for (let i = 0; i < eyeGroups.length; i++) {
      const close = pose.blink;
      eyeGroups[i].scale.y = Math.max(0.04, 1 - close * 1.15);
      eyeGroups[i].visible = close < 0.78;
      closedEyes[i].visible = close >= 0.78;
    }
    mouth.scale.y = 1 + pose.nibble * 0.4;
    tongue.visible = pose.nibble > 0.5;
    updateTail(pose);
    toy.visible = pose.toy > 0.05;
    toy.position.set(-0.95 + Math.sin(pose.elapsed * 5) * 0.26, 0.32 + Math.abs(Math.sin(pose.elapsed * 5.1)) * 0.7, 0.95);
    toy.rotation.set(pose.elapsed * 2, 0, pose.elapsed * 3);
    toy.scale.setScalar(0.6 + pose.toy * 0.4);
    sleepy.visible = s > 0.8;
    sleepy.position.set(0.9, 1.8 + Math.sin(pose.elapsed * 1.4) * 0.07, 0.6);
    for (let i = 0; i < sleepy.children.length; i++) sleepy.children[i].material.opacity = s * (0.55 + Math.sin(pose.elapsed * 1.4 - i * 0.8) * 0.25);
    shadow.scale.set(1 + s * 0.12 - pose.hop * 0.3, 1 - pose.hop * 0.3, 1);
    try {
      renderer.render(scene, camera);
      if (!ready) { ready = true; container.classList.add('has-cat-model'); onReady?.(); }
    } catch (error) { fail(error); return; }
    // Respect reduced motion: static idle model, render only for a user action or a view change.
    if (!destroyed && !failed && !paused && !frame && (!reducedMotion || now < animateUntil)) frame = requestAnimationFrame(animate);
  }
}
