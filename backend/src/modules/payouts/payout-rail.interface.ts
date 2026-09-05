// Payout rail port — the USDC->INR off-ramp "last mile". After the escrow releases
// on-chain (settlement port), the settled value must actually reach the freelancer as
// INR: pushed to a UPI id (a VPA) or a bank account. This mirrors the settlement port
// exactly — a SIMULATED rail ships by default so the whole payment lifecycle works with
// no external partner, and a real PA-CB / AD-bank rail implements the SAME interface and
// is swapped in via setPayoutRail() once licensing exists (ROADMAP #13). The payment
// orchestrator talks only to this port; it never learns the vendor.
import { randomBytes } from 'node:crypto';

export type PayoutStatus = 'SENT' | 'CREDITED' | 'PENDING' | 'FAILED';

export interface PayoutDestination {
  method: 'BANK' | 'UPI';
  accountName: string | null;
  vpa: string | null;
  accountNumberMasked: string | null;
  bankIdentifier: string | null;
}

export interface PayoutInstruction {
  paymentId: string;
  amountMinorInr: number; // INR the payee receives, in paise (Payment.dstAmountMinor)
  destination: PayoutDestination;
  purposeCode: string | null; // FEMA purpose code — flows to the FIRC / eBRC
  reference: string; // our payment reference, echoed in the rail memo
}

export interface PayoutResult {
  railRef: string; // the rail's reference (UTR-like); stored on Payment.payoutRailRef
  status: PayoutStatus;
  upiIntent: string | null; // a upi:// deep-link / QR payload for UPI; null for bank
}

export interface PayoutRail {
  execute(i: PayoutInstruction): Promise<PayoutResult>;
  status(railRef: string): Promise<PayoutStatus>;
}

// Build a UPI intent URL — the payload behind the scannable "pay to this VPA" QR.
// Pure and unit-tested. amountMinorInr is paise; UPI expects rupees with 2 decimals.
export function buildUpiIntent(
  vpa: string,
  payeeName: string,
  amountMinorInr: number,
  reference: string,
): string {
  // The VPA is kept literal (UPI apps expect pa=name@bank, not percent-encoded);
  // our VPA_REGEX already limits it to url-safe characters. Name/note are encoded.
  const rupees = (amountMinorInr / 100).toFixed(2);
  const pn = encodeURIComponent(payeeName || 'Payee');
  const tn = encodeURIComponent(`Corridor ${reference}`.slice(0, 60));
  return `upi://pay?pa=${vpa}&pn=${pn}&am=${rupees}&cu=INR&tn=${tn}`;
}

// Map a stored payout account row to a rail destination. Pure + tested. An absent
// or unknown method degrades to BANK (back-compat with pre-UPI accounts).
export function destinationFromAccount(a: {
  method: string | null;
  accountName: string | null;
  vpa: string | null;
  accountNumberMasked: string | null;
  bankIdentifier: string | null;
}): PayoutDestination {
  return {
    method: a.method === 'UPI' ? 'UPI' : 'BANK',
    accountName: a.accountName ?? null,
    vpa: a.vpa ?? null,
    accountNumberMasked: a.accountNumberMasked ?? null,
    bankIdentifier: a.bankIdentifier ?? null,
  };
}

const makeRailRef = (method: 'BANK' | 'UPI'): string =>
  (method === 'UPI' ? 'UPI-' : 'NEFT-') + randomBytes(6).toString('hex').toUpperCase();

// Simulated off-ramp — no external partner. Delivers instantly (CREDITED) and, for a
// UPI destination, returns the upi:// intent to render as a QR. Honest fallback path
// (ROADMAP risk R1), swapped for a real rail via setPayoutRail().
export const simulatedPayoutRail: PayoutRail = {
  async execute(i: PayoutInstruction): Promise<PayoutResult> {
    const railRef = makeRailRef(i.destination.method);
    const upiIntent =
      i.destination.method === 'UPI' && i.destination.vpa
        ? buildUpiIntent(i.destination.vpa, i.destination.accountName ?? 'Payee', i.amountMinorInr, i.reference)
        : null;
    return { railRef, status: 'CREDITED', upiIntent };
  },
  async status(): Promise<PayoutStatus> {
    return 'CREDITED';
  },
};

// Swapped by a real PA-CB / AD-bank rail via setPayoutRail() at boot (ROADMAP #13).
let active: PayoutRail = simulatedPayoutRail;
export const getPayoutRail = (): PayoutRail => active;
export const setPayoutRail = (r: PayoutRail): void => {
  active = r;
};
