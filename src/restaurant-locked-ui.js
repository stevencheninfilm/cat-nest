/** A visual state only: a locked preview can still open its requirements or
 * offer an already eligible purchase. Never infer this from button.disabled. */
export const restaurantLockedAttributes=locked=>locked?'data-r-locked="true"':'';
export const restaurantLockIcon=()=>'<svg class="r-lock-icon" data-r-lock-indicator viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="10" width="12" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg>';
