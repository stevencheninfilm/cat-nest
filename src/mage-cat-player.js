import * as THREE from 'three';
import { clipKey } from './mage-cat-animation.js';

/** Reuse the author's tracks verbatim, with one current action and short fades. */
export function createMageAnimationPlayer(mixer, animations) {
  const clips = new Map(animations.map(clip => [clipKey(clip.name), clip]));
  let current, signature;
  return {
    sync(behavior) {
      const key = clips.has(behavior.clip) ? behavior.clip : 'idle';
      if (!clips.has(key)) return;
      const nextSignature = key === 'idle' && behavior.source !== 'animation' ? key : `${key}:${behavior.token}`;
      if (signature === nextSignature) { current.setEffectiveTimeScale(behavior.rate); return; }
      const before = current;
      current = mixer.clipAction(clips.get(key));
      current.stopFading(); current.reset(); current.enabled = true;
      current.setLoop(behavior.loop ? THREE.LoopRepeat : THREE.LoopOnce, behavior.loop ? Infinity : 1);
      current.clampWhenFinished = !behavior.loop;
      current.setEffectiveTimeScale(behavior.rate); current.setEffectiveWeight(1); current.play();
      if (before && before !== current) { before.stopFading(); before.fadeOut(.24); current.fadeIn(.24); }
      signature = nextSignature;
    },
    update(delta) {
      mixer.update(delta);
      for (const clip of clips.values()) {
        const action = mixer.existingAction(clip);
        if (action && action !== current && action.getEffectiveWeight() === 0) action.stop();
      }
    },
  };
}
