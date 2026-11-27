/**
 * Owner Identity & Injective Namespace Management
 *
 * Provides a mathematically injective mapping from any user UID to an isolated
 * IndexedDB and localStorage namespace, and maintains an explicit discriminator
 * between guest sessions and authenticated users (even if a user's UID is "guest").
 */

export type OwnerIdentity = 
  | { kind: 'guest' }
  | { kind: 'user'; uid: string };

/**
 * Injective encoding of arbitrary UID strings into safe hexadecimal ASCII.
 * Guarantees that different UIDs (e.g. 'a.b' vs 'a_b') never collide.
 */
export function encodeUidInjective(uid: string): string {
  if (typeof uid !== 'string') return '';
  const encoder = new TextEncoder();
  const bytes = encoder.encode(uid);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Decodes an injective hex string back into the original UID.
 */
export function decodeUidInjective(hex: string): string {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) return '';
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Converts an OwnerIdentity (or legacy raw owner string) into an immutable,
 * collision-free owner storage key.
 *
 * Namespace boundaries:
 * - Guest session: always 'g_guest'
 * - Authenticated user: always 'u_' + hex(uid)
 *
 * This guarantees:
 * 1. Guest and user namespaces are strictly disjoint ('g_' vs 'u_').
 * 2. An authenticated user whose UID happens to be "guest" is mapped to
 *    'u_6775657374', which NEVER collides with 'g_guest'.
 * 3. UIDs with punctuation like 'a.b' and 'a_b' map to 'u_612e62' and
 *    'u_615f62', which NEVER collide.
 */
export function toOwnerKey(identity: OwnerIdentity | string | null | undefined): string {
  if (!identity) {
    return 'g_guest';
  }
  if (typeof identity === 'object' && 'kind' in identity) {
    if (identity.kind === 'guest') {
      return 'g_guest';
    }
    return `u_${encodeUidInjective(identity.uid)}`;
  }
  if (typeof identity === 'string') {
    if (identity === 'guest' || identity === 'g_guest') {
      return 'g_guest';
    }
    if (identity.startsWith('u_') || identity.startsWith('g_')) {
      return identity;
    }
    return `u_${encodeUidInjective(identity)}`;
  }
  return 'g_guest';
}

/**
 * Parses an owner key back into a typed OwnerIdentity.
 */
export function toOwnerIdentity(ownerKeyOrIdentity: OwnerIdentity | string | null | undefined): OwnerIdentity {
  if (!ownerKeyOrIdentity) {
    return { kind: 'guest' };
  }
  if (typeof ownerKeyOrIdentity === 'object' && 'kind' in ownerKeyOrIdentity) {
    return ownerKeyOrIdentity;
  }
  if (ownerKeyOrIdentity === 'guest' || ownerKeyOrIdentity === 'g_guest') {
    return { kind: 'guest' };
  }
  if (typeof ownerKeyOrIdentity === 'string') {
    if (ownerKeyOrIdentity.startsWith('u_')) {
      const hex = ownerKeyOrIdentity.slice(2);
      return { kind: 'user', uid: decodeUidInjective(hex) };
    }
    return { kind: 'user', uid: ownerKeyOrIdentity };
  }
  return { kind: 'guest' };
}

/**
 * Returns the owner-scoped key for setup/onboarding completion in localStorage.
 */
export function getOwnerOnboardingKey(identity: OwnerIdentity | string | null | undefined): string {
  const key = toOwnerKey(identity);
  return `mboafit_onboarding_${key}`;
}
