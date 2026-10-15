import * as THREE from 'three';
import { createCatModel } from './cat-model.js';

/** Court-only geometry around the exact same licensed cat renderer as home. */
export function createCourtJudge({ container, assetBase, getAppearance = () => undefined, onReady, onError }) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let avatar, queuedStrike = false;
  const api = {
    announce() {
      if (container.dataset.modelPhase !== 'ready') { queuedStrike = true; return; }
      avatar.stageAction('strike');
      container.classList.remove('is-striking');
      if (!reducedMotion) requestAnimationFrame(() => container.classList.add('is-striking'));
    },
    setPaused(value) { avatar?.setPaused(value); },
    syncAppearance() { avatar?.setState({ sleeping: false, appearance: getAppearance() }); },
    destroy() { avatar?.destroy(); },
  };
  avatar = createCatModel({
    container, assetBase, reducedMotion, autonomous: false,
    onReady() { api.syncAppearance(); onReady?.(); if (queuedStrike) { queuedStrike = false; api.announce(); } },
    onError,
    decorateScene({ scene, model, pivot }) {
      const geometry = new Set(), materials = new Set();
      const wood = new THREE.MeshStandardMaterial({ color: 0x6c3528, roughness: .38 });
      const edge = new THREE.MeshStandardMaterial({ color: 0xb26d39, roughness: .32 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xd8b15c, metalness: .65, roughness: .27 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x321d24, roughness: .72 });
      [wood, edge, gold, dark].forEach(value => materials.add(value));
      const make = (shape, material, parent) => {
        geometry.add(shape); const mesh = new THREE.Mesh(shape, material); parent.add(mesh); return mesh;
      };
      const fixture = new THREE.Group(); scene.add(fixture);
      const gavel = new THREE.Group(); fixture.add(gavel);
      const handle = make(new THREE.CylinderGeometry(.045, .055, .58, 16), wood, gavel); handle.position.y = .12;
      const head = make(new THREE.CylinderGeometry(.14, .14, .48, 24), wood, gavel); head.rotation.z = Math.PI / 2; head.position.y = .45;
      for (const x of [-.19, .19]) { const ring = make(new THREE.CylinderGeometry(.15, .15, .035, 24), gold, gavel); ring.rotation.z = Math.PI / 2; ring.position.set(x, .45, 0); }
      const grip = make(new THREE.SphereGeometry(.062, 16, 12), edge, gavel); grip.position.y = -.19;
      const block = make(new THREE.CylinderGeometry(.23, .26, .075, 32), edge, fixture);
      const blockEdge = make(new THREE.CylinderGeometry(.26, .26, .03, 32), gold, fixture);
      const bench = make(new THREE.BoxGeometry(3.55, .22, .5), wood, fixture);
      const rim = make(new THREE.BoxGeometry(3.65, .065, .58), edge, fixture);
      const trim = make(new THREE.BoxGeometry(3.12, .025, .02), gold, fixture);
      const plaque = make(new THREE.BoxGeometry(.62, .13, .025), dark, fixture);
      let hand;
      model.traverse(node => { if (!hand && node.isBone && /^Hand_R(?:_|$)/.test(node.name)) hand = node; });
      const palm = new THREE.Vector3();
      let time = 99;
      const hideWand = () => model.traverse(node => {
        if (node.isMesh && (Array.isArray(node.material) ? node.material : [node.material]).some(material => material.name === 'Mage_Cat_Wand')) node.visible = false;
      });
      hideWand();
      function pose(delta) {
        time += delta;
        const active = time < 1.15 && !reducedMotion;
        const phase = active ? time / 1.15 : 1;
        let angle = -.24, dip = 0;
        if (active) {
          if (phase < .34) angle = -.24 - Math.sin(phase / .34 * Math.PI / 2) * .7;
          else if (phase < .58) { const t = (phase - .34) / .24; angle = -.94 - 1.7 * t * t; dip = .12 * t; }
          else { const t = (phase - .58) / .42; angle = -2.64 + 2.4 * (1 - (1 - t) ** 3); dip = .12 * (1 - t); }
          pivot.rotation.z -= Math.sin(Math.PI * phase) * .045;
        }
        pivot.updateWorldMatrix(true, true);
        if (hand) hand.getWorldPosition(palm); else palm.set(-.55, 1.05, .4);
        // Some LOD skeleton copies are outside the visible normalized rig.
        // Keep the court accessory beside the visible paw in that case.
        if (![palm.x, palm.y, palm.z].every(Number.isFinite) || Math.abs(palm.x) > 1.6 || palm.y < .3 || palm.y > 2.2 || Math.abs(palm.z) > 1.5) palm.set(-.55, 1.05, .4);
        // Use the author's actual paw location; only the accessory is procedural.
        const side = palm.x < 0 ? -1 : 1;
        gavel.position.set(palm.x + side * .24, palm.y - dip, Math.max(1.1, palm.z + .35));
        gavel.rotation.set(0, .18, angle);
        const y = palm.y - .69, z = gavel.position.z;
        block.position.set(palm.x + .35, y, z); blockEdge.position.set(palm.x + .35, y - .048, z);
        bench.position.set(0, y - .23, z); rim.position.set(0, y - .09, z);
        trim.position.set(0, y - .19, z + .262); plaque.position.set(0, y - .24, z + .265);
      }
      pose(0);
      return {
        act(action) { if (action === 'strike') time = 0; },
        update(delta) { pose(delta); },
        resize() { hideWand(); },
        destroy() { scene.remove(fixture); geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); },
      };
    },
  });
  return api;
}
