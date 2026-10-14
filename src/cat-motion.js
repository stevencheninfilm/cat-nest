/** A small, deterministic animation clock shared by the 3D kitten's articulated parts. */
export function createCatMotion({ reducedMotion = false } = {}) {
  let elapsed = 0;
  let reaction = '';
  let reactionTime = 100;
  let sleeping = false;
  let sleep = 0;
  const duration = { pet: 2.6, play: 3.2, feed: 2.5, wave: 2.7, dance: 3.5 };

  return {
    setState(state = {}) {
      if (typeof state.sleeping === 'boolean') sleeping = state.sleeping;
    },
    react(type, state) {
      if (type && typeof type === 'object') type = type.type;
      if (state && typeof state.sleeping === 'boolean') sleeping = state.sleeping;
      else if (type === 'sleep') sleeping = !sleeping;
      else if (duration[type]) sleeping = false;
      reaction = duration[type] ? type : '';
      reactionTime = 0;
    },
    advance(delta) {
      const dt = Math.max(0, Math.min(0.1, Number.isFinite(delta) ? delta : 0));
      elapsed += dt;
      reactionTime += dt;
      sleep += ((sleeping ? 1 : 0) - sleep) * (1 - Math.exp(-dt * 3.2));
      const end = duration[reaction] || 0;
      const progress = end ? Math.min(1, reactionTime / end) : 1;
      const strength = progress < 1 ? Math.sin(progress * Math.PI) : 0;
      const movement = reducedMotion ? 0.28 : 1;
      // A brief blink every ~4 seconds, kept independent from the reaction clock.
      const blinkPhase = elapsed % 4.7;
      const blink = blinkPhase > 4.36 && blinkPhase < 4.64
        ? Math.sin(((blinkPhase - 4.36) / 0.28) * Math.PI) ** 2 : 0;
      const pet = reaction === 'pet' ? strength : 0;
      const play = reaction === 'play' ? strength : 0;
      const feed = reaction === 'feed' ? strength : 0;
      const wave = reaction === 'wave' ? strength : 0;
      const dance = reaction === 'dance' ? strength : 0;
      return {
        elapsed, reaction, progress, strength, sleep, sleeping,
        breath: Math.sin(elapsed * (sleep > 0.5 ? 1.55 : 2.1)) * 0.012 * movement,
        blink: Math.max(blink, sleep, pet * 0.83),
        headTilt: (Math.sin(elapsed * 0.62) * 0.035 + pet * Math.sin(reactionTime * 4) * 0.2 + dance * Math.sin(reactionTime * 7) * 0.19) * movement,
        headYaw: (Math.sin(elapsed * 0.48) * 0.07 + play * Math.sin(reactionTime * 6) * 0.13) * movement,
        headPitch: (feed * (0.12 + Math.sin(reactionTime * 13) * 0.055) - pet * 0.045) * movement,
        hop: (play * Math.abs(Math.sin(reactionTime * 5.1)) * 0.23 + dance * Math.abs(Math.sin(reactionTime * 7)) * 0.1) * movement,
        sway: (play * Math.sin(reactionTime * 5.1) * 0.075 + dance * Math.sin(reactionTime * 7) * 0.16) * movement,
        leftPaw: (play * (0.5 + Math.sin(reactionTime * 6.2) * 0.5) + wave * (0.72 + Math.sin(reactionTime * 9) * 0.16) + dance * (0.5 + Math.sin(reactionTime * 7) * 0.45)) * movement,
        rightPaw: (play * (0.5 - Math.sin(reactionTime * 6.2) * 0.5) + dance * (0.5 - Math.sin(reactionTime * 7) * 0.45)) * movement,
        earTwitch: Math.max(0, Math.sin(elapsed * 0.82)) ** 18 * 0.13 * movement,
        tail: Math.sin(elapsed * (play > 0 ? 5.5 : 1.55)) * (0.12 + play * 0.19) * movement * (1 - sleep * 0.8),
        nibble: feed * (0.55 + Math.sin(reactionTime * 13) * 0.45),
        toy: play,
      };
    },
  };
}
