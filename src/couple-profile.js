/** Stable identities for the two people sharing this home's cloud save. */
export const COUPLE_ROLES = Object.freeze([
  Object.freeze({ id: 'male', name: '男方', clientId: 'partner-male' }),
  Object.freeze({ id: 'female', name: '女方', clientId: 'partner-female' }),
]);

export function normalizeCoupleRole(value) {
  return COUPLE_ROLES.some(role => role.id === value) ? value : null;
}

export function getCoupleProfile(role) {
  return COUPLE_ROLES.find(profile => profile.id === normalizeCoupleRole(role)) || null;
}
