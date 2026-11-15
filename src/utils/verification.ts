// DA verification workflow helpers shared by the registration form, the
// role dashboards and the DA Admin Console.
//
// Every new Farmer/Buyer registration enters the Admin Console's
// "Pending User Verifications" queue with verification_status = 'Pending'.
// Only an explicit Admin Approve unlocks full transactional access:
//   - Pending Farmers cannot submit harvests for sale
//   - Pending Buyers cannot place vegetable orders
//
// Legacy accounts registered before this workflow existed were granted
// immediate access, so they read as 'Approved' when the field is missing.
import { UserProfile, VerificationStatus } from '../types';

/** Resolves the effective verification state of an account. */
export const verificationStateOf = (u?: UserProfile | null): VerificationStatus => {
  if (!u) return 'Approved';
  if (u.verificationStatus === 'Pending' || u.verificationStatus === 'Approved' || u.verificationStatus === 'Rejected') {
    return u.verificationStatus;
  }
  // Legacy accounts (pre-verification flow) keep their original access.
  return 'Approved';
};

/** True when the account is logged in but still awaiting DA Admin approval. */
export const isVerificationPending = (u?: UserProfile | null): boolean =>
  verificationStateOf(u) === 'Pending';

/** True when the account was explicitly rejected by the DA Admin. */
export const isVerificationRejected = (u?: UserProfile | null): boolean =>
  verificationStateOf(u) === 'Rejected';

/** RSBSA registry number format (e.g. 07-46-10-001-000001). Digits grouped by
 *  dashes; validated ONLY when the farmer types something (field optional). */
export const RSBSA_PATTERN = /^[0-9]{2,3}(?:-[0-9]{2,6}){2,4}$/;

export const isValidRsbsaNumber = (value: string): boolean => RSBSA_PATTERN.test(value.trim());

/** Human-readable format hint shown under the RSBSA input. */
export const RSBSA_FORMAT_HINT = 'Format: 07-46-10-001-000001 — digits separated by dashes';

/** Accepted document image types + 5MB hard limit for uploads. */
export const DOC_ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
export const DOC_MAX_BYTES = 5 * 1024 * 1024;

export const describeDocFileError = (file: File): string | null => {
  if (!DOC_ACCEPTED_TYPES.includes(file.type)) {
    return 'Only .jpg, .jpeg and .png image files are accepted.';
  }
  if (file.size > DOC_MAX_BYTES) {
    return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB) — the limit is 5MB. Please pick a smaller photo.`;
  }
  return null;
};
