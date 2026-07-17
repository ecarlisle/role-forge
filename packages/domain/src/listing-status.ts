/**
 * Listing-status state machine.
 *
 * Defines valid transitions between listing statuses and provides
 * functions to validate and apply transitions.
 */

import type { ListingStatus } from "./schemas";

const VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  new: ["saved", "dismissed", "flagged"],
  saved: ["dismissed", "flagged"],
  dismissed: ["saved", "flagged"],
  flagged: ["saved", "dismissed"],
};

/**
 * Check whether a status transition is allowed.
 */
export function isValidTransition(from: ListingStatus, to: ListingStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Apply a status transition. Throws if the transition is invalid.
 */
export function transitionStatus(
  current: ListingStatus,
  next: ListingStatus,
): { status: ListingStatus; transitionedAt: string } {
  if (!isValidTransition(current, next)) {
    throw new Error(
      `Invalid status transition: "${current}" → "${next}". ` +
        `Allowed transitions from "${current}": ${VALID_TRANSITIONS[current]?.join(", ") ?? "none"}`,
    );
  }
  return {
    status: next,
    transitionedAt: new Date().toISOString(),
  };
}

/**
 * Returns the list of statuses reachable from the given status.
 */
export function getAvailableTransitions(from: ListingStatus): ListingStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}
