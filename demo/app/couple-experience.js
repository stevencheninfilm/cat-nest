import { normalizeCoupleCare } from './couple-care.js';
import { COUPLE_ROLES, getCoupleProfile } from './couple-profile.js';

/** Receives confirmed snapshots only; transport replays must never replay feedback. */
export function createCoupleExperience({ readSeen = () => null, writeSeen = () => {}, canNotify = () => true,
  onActivity = () => {}, onMoment = () => {}, onArrival = () => {} } = {}) {
  let role, partner, key, initialized = false, rosterKnown = false, partnerOnline = false;
  let records = new Set(), moments = new Set(), pendingActivity = null, pendingMoment = null;
  let watermark = null;
  function reset({ role:nextRole, roomId }) {
    role = getCoupleProfile(nextRole);
    partner = COUPLE_ROLES.find(profile => profile.id !== role?.id);
    key = role && roomId ? `catnest.partnerSeen.${roomId}.${role.id}` : null;
    watermark = key ? readSeen(key) : null;
    initialized = rosterKnown = partnerOnline = false;
    records = new Set(); moments = new Set(); pendingActivity = pendingMoment = null;
  }
  return {
    reset,
    observe(state, now = Date.now()) {
      if (!key || !role || !partner) return;
      const care = normalizeCoupleCare(state.coupleCare, now);
      const latest = care.records.find(record => record.actorId === partner.clientId);
      if (!initialized) {
        for (const record of care.records) records.add(record.id);
        for (const moment of care.moments) moments.add(moment.id);
        if (latest && watermark && latest.id !== watermark.id && latest.at >= watermark.at) pendingActivity = { record:latest, away:true };
        initialized = true;
      } else {
        const fresh = care.records.filter(record => record.actorId === partner.clientId && !records.has(record.id));
        for (const record of care.records) records.add(record.id);
        if (fresh.length) pendingActivity = { record:fresh[0], away:!canNotify() };
        for (const moment of care.moments.slice().reverse()) {
          if (!moments.has(moment.id)) { moments.add(moment.id); pendingMoment = moment; }
        }
      }
      if (!canNotify()) return;
      if (pendingMoment) { onMoment(pendingMoment); pendingMoment = null; pendingActivity = null; }
      else if (pendingActivity) { onActivity(pendingActivity.record, { away:pendingActivity.away }); pendingActivity = null; }
      if (latest) {
        const next = { id:latest.id, at:latest.at };
        if (watermark?.id !== next.id) { writeSeen(key, next); watermark = next; }
      }
    },
    presence(members, connected) {
      if (!connected) { rosterKnown = false; return; }
      if (!partner || !role) return;
      const online = members.some(member => member.id === partner.clientId);
      if (rosterKnown && online && !partnerOnline && canNotify()) onArrival(partner);
      partnerOnline = online; rosterKnown = true;
    },
  };
}
