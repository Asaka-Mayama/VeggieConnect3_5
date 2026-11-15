// DA Admin Console — "View Documents" modal for the Pending User
// Verifications queue. Shows the uploaded Valid Government ID (mandatory for
// both roles) plus the role-specific extras:
//   - Farmer: RSBSA Number (optional) → "DA Registered" badge when present
//   - Buyer : Small Business Proof (optional) → "Verified Business" badge
// The Admin can Approve / Reject directly from the modal or from the queue.
import React, { useEffect } from 'react';
import {
  X,
  IdCard,
  FileImage,
  BadgeCheck,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { UserProfile } from '../types';
import { verificationStateOf } from '../utils/verification';

interface VerificationReviewModalProps {
  user: UserProfile | null;
  onClose: () => void;
  onApprove: (user: UserProfile) => void;
  onReject: (user: UserProfile) => void;
}

const hasImage = (v?: string): boolean =>
  Boolean(v && typeof v === 'string' && v.startsWith('data:image'));

export const VerificationReviewModal: React.FC<VerificationReviewModalProps> = ({
  user,
  onClose,
  onApprove,
  onReject,
}) => {
  // Close on Escape so the Admin can skim the queue with the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!user) return null;

  const isFarmer = user.role === 'farmer';
  const state = verificationStateOf(user);
  const rsbsaProvided = Boolean(user.rsbsaNumber && user.rsbsaNumber.trim());
  const businessProofProvided = hasImage(user.businessProofImage);
  const validIdProvided = hasImage(user.validIdImage);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-neutral-950/70 backdrop-blur-[2px]">
      <div className="w-full max-h-full overflow-y-auto bg-white rounded-3xl shadow-2xl border border-neutral-200">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-4 flex items-start justify-between gap-3 rounded-t-3xl">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">
              Pending User Verification · DA Admin Console
            </p>
            <h3 className="text-sm font-black truncate mt-0.5">{user.name}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                  isFarmer ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/40' : 'bg-sky-400/20 text-sky-100 border border-sky-300/40'
                }`}
              >
                {user.role}
              </span>
              {state === 'Pending' ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-amber-400/20 text-amber-100 border border-amber-300/40 flex items-center gap-1">
                  <Clock3 className="w-3 h-3" /> Pending Review
                </span>
              ) : state === 'Approved' ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-emerald-400/20 text-emerald-100 border border-emerald-300/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Approved
                </span>
              ) : (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-400/20 text-rose-100 border border-rose-300/40 flex items-center gap-1">
                  <ShieldX className="w-3 h-3" /> Rejected
                </span>
              )}
              {/* Automatic verification badges */}
              {isFarmer && rsbsaProvided && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-white text-emerald-800 flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> DA Registered
                </span>
              )}
              {!isFarmer && businessProofProvided && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-white text-sky-800 flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Verified Business
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            id="btn-verification-close"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors flex-shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Applicant summary */}
          <div className="grid grid-cols-1 gap-1.5 text-[11px] text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
            <p className="flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-bold">{user.name}</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-mono">{user.phone}</span>
              {user.email && <span className="truncate text-neutral-500">· {user.email}</span>}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span className="truncate">{user.location}</span>
            </p>
            {isFarmer && user.farmName && (
              <p className="flex items-center gap-2 text-emerald-800">
                <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">🌱</span>
                <span className="font-bold">{user.farmName}</span>
              </p>
            )}
            {user.submittedAt && (
              <p className="text-[10px] text-neutral-400 font-mono">
                Submitted: {new Date(user.submittedAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* REQUIRED — Valid Government ID */}
          <div>
            <p className="text-[11px] font-black text-neutral-900 mb-1.5 flex items-center gap-1.5">
              <IdCard className="w-4 h-4 text-emerald-700" />
              Valid Government ID <span className="text-red-500">*</span>
              {!validIdProvided && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  Missing
                </span>
              )}
            </p>
            {validIdProvided ? (
              <img
                src={user.validIdImage}
                alt="Valid Government ID"
                className="w-full max-h-72 object-contain rounded-2xl border border-neutral-200 bg-neutral-50"
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-[11px] text-amber-700">
                No Valid ID image on file for this legacy account.
              </div>
            )}
          </div>

          {/* Farmer — RSBSA Number */}
          {isFarmer && (
            <div
              className={`rounded-2xl border p-3 ${
                rsbsaProvided ? 'border-emerald-200 bg-emerald-50/60' : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <p className="text-[11px] font-black text-neutral-900 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <FileImage className="w-4 h-4 text-emerald-700" />
                  RSBSA Number <span className="font-medium text-neutral-500">(Optional)</span>
                </span>
                {rsbsaProvided && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-emerald-700 text-white flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> DA Registered
                  </span>
                )}
              </p>
              <p className={`text-xs font-mono mt-1.5 ${rsbsaProvided ? 'text-emerald-900' : 'text-neutral-400'}`}>
                {rsbsaProvided ? user.rsbsaNumber : 'Not provided — no automatic DA Registered badge'}
              </p>
            </div>
          )}

          {/* Buyer — Small Business Proof */}
          {!isFarmer && (
            <div>
              <p className="text-[11px] font-black text-neutral-900 mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <FileImage className="w-4 h-4 text-sky-700" />
                  Small Business Proof <span className="font-medium text-neutral-500">(Optional)</span>
                </span>
                {businessProofProvided && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-sky-700 text-white flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> Verified Business
                  </span>
                )}
              </p>
              {businessProofProvided ? (
                <img
                  src={user.businessProofImage}
                  alt="Small Business Proof"
                  className="w-full max-h-72 object-contain rounded-2xl border border-neutral-200 bg-neutral-50"
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-[11px] text-neutral-500">
                  Not provided — optional Barangay Clearance / DTI / Business Permit for small businesses.
                </div>
              )}
            </div>
          )}

          {/* Decision bar */}
          {state === 'Pending' ? (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                id="btn-verification-approve"
                onClick={() => onApprove(user)}
                className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Approve
              </button>
              <button
                type="button"
                id="btn-verification-reject"
                onClick={() => onReject(user)}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <ShieldX className="w-4 h-4" />
                Reject
              </button>
            </div>
          ) : (
            <div
              className={`rounded-2xl border p-3 text-[11px] font-bold text-center ${
                state === 'Approved'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {state === 'Approved'
                ? 'This account was approved — the applicant can now log in and trade.'
                : 'This registration was rejected — the account cannot log in.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
