// Zod request/response schemas — the wire contract (BUILD_CONTRACTS §4).
import { z } from 'zod';
import { ROLES, CURRENCIES, PURPOSE_CODES, ESCROW_MODES, CADENCES, PAYOUT_METHODS } from './enums.js';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES),
  country: z.string().length(2),
  name: z.string().min(1),
  // company-only
  legalName: z.string().optional(),
  regNumber: z.string().optional(),
  // freelancer-only
  panOrTaxId: z.string().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const kycSubmitSchema = z.object({
  panOrTaxId: z.string().min(1),
  documentType: z.string().min(1),
  documentRef: z.string().min(1), // mock — any string
});

export const kybSubmitSchema = z.object({
  legalName: z.string().min(1),
  regNumber: z.string().min(1),
  country: z.string().length(2),
});

export const createPaymentSchema = z.object({
  payeeId: z.string().uuid(),
  srcCurrency: z.enum(CURRENCIES),
  dstCurrency: z.enum(CURRENCIES),
  srcAmountMinor: z.number().int().positive(),
  purposeCode: z.enum(PURPOSE_CODES),
  invoiceRef: z.string().optional(),
  // FR-2.2. Optional and INSTANT by default, so every existing caller keeps the
  // one-click settle-through behaviour unchanged.
  escrowMode: z.enum(ESCROW_MODES).optional().default('INSTANT'),
});
// z.input, not z.infer: escrowMode has a default, so callers that build the input
// by hand (the pay-run fan-out, the schedule runner) may omit it, while a parsed
// request body — where it is always present — still satisfies the type.
export type CreatePaymentInput = z.input<typeof createPaymentSchema>;

export const confirmPaymentSchema = z.object({
  quoteId: z.string().uuid(),
});

export const createInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.enum(CURRENCIES),
  memo: z.string().min(1),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// --- Batch pay-run (FR-2.5): pay N freelancers in one action ---
// One line item per payee. The whole run goes through the SAME orchestrator
// (one compliance evaluation per child payment), then approved children confirm
// together. Items reuse the single-payment field shape.
export const payRunItemSchema = z.object({
  payeeId: z.string().uuid(),
  srcCurrency: z.enum(CURRENCIES),
  dstCurrency: z.enum(CURRENCIES),
  srcAmountMinor: z.number().int().positive(),
  purposeCode: z.enum(PURPOSE_CODES),
});
export type PayRunItemInput = z.infer<typeof payRunItemSchema>;

export const createPayRunSchema = z.object({
  note: z.string().optional(),
  items: z.array(payRunItemSchema).min(1).max(50),
});
export type CreatePayRunInput = z.infer<typeof createPayRunSchema>;

// --- Recurring payouts (retainers): schedule a repeating payment ---
export const createScheduleSchema = z.object({
  payeeId: z.string().uuid(),
  srcCurrency: z.enum(CURRENCIES),
  dstCurrency: z.enum(CURRENCIES),
  srcAmountMinor: z.number().int().positive(),
  purposeCode: z.enum(PURPOSE_CODES),
  cadence: z.enum(CADENCES),
  startAt: z.string().datetime().optional(), // ISO; defaults to first cadence period from now
});
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

// name@psp — a UPI Virtual Payment Address. Declared here because both the
// customer-creation and payout-account schemas below validate against it.
export const VPA_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/; // name@psp

// --- Customer management (create + manage the parties in the platform) ---
// An EVM account. The address is the settlement identity money moves to; the key
// is what signs on its behalf. Both are demo/testnet-only values — the platform
// custodies the key so the agent can settle without a wallet popup, which is only
// acceptable because these are throwaway test accounts (see docs/DEPLOY_TESTNET.md).
export const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
export const EVM_PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

export const createCustomerSchema = z
  .object({
    role: z.enum(['COMPANY', 'FREELANCER']),
    name: z.string().min(1),
    email: z.string().email(),
    country: z.string().length(2),
    phone: z.string().optional(),
    password: z.string().min(6).optional(), // defaults to a generated one if omitted
    // company
    legalName: z.string().optional(),
    regNumber: z.string().optional(),
    // freelancer
    panOrTaxId: z.string().optional(),
    // when true, provision wallet + issue credential + mark verified immediately
    verified: z.boolean().optional(),
    // --- settlement wallet (optional; generated when omitted) ---
    // Supply an address to send real value to an account you control, and/or a
    // private key so the platform can sign FROM it. A key alone is enough — the
    // address is derived from it. Supplying only an address makes the party a
    // receive-only payee: it can be paid, but cannot itself fund a payment.
    walletAddress: z.string().regex(EVM_ADDRESS_REGEX, 'Wallet address must be 0x + 40 hex characters').optional(),
    walletKey: z.string().regex(EVM_PRIVATE_KEY_REGEX, 'Private key must be 0x + 64 hex characters').optional(),
    // --- payout destination (the off-ramp last mile) ---
    // Where the freelancer's money lands after on-chain release. Without one, a
    // payment to them settles on-chain and then dies in PAYOUT_FAILED, so the
    // company can set it at creation instead of waiting for the payee to log in.
    payoutMethod: z.enum(PAYOUT_METHODS).optional(),
    payoutCurrency: z.enum(CURRENCIES).optional(), // defaults to the corridor default (INR)
    payoutLabel: z.string().optional(),
    vpa: z.string().regex(VPA_REGEX, 'UPI id must look like name@bank').optional(),
    accountName: z.string().min(1).optional(),
    accountNumber: z.string().min(4).optional(),
    bankIdentifier: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.payoutMethod && v.role !== 'FREELANCER') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payoutMethod'], message: 'Only a freelancer has a payout destination' });
    }
    if (v.payoutMethod === 'UPI' && !v.vpa) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vpa'], message: 'A UPI id is required for a UPI payout method' });
    }
    if (v.payoutMethod === 'BANK' && !(v.accountName && v.accountNumber && v.bankIdentifier)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountNumber'], message: 'A bank payout needs an account name, number and IFSC/IBAN/routing' });
    }
  });
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// Change a party's settlement wallet after creation. Same rules as creation
// (see createCustomerSchema): a key derives its own address, a contradicting pair
// is refused, and an address alone is receive-only. Separate from the creation
// schema because this is the one field an operator needs to change on a party
// that already exists — swapping a generated demo wallet for a funded account
// they control, without wiping and re-seeding the database.
export const updateWalletSchema = z
  .object({
    walletAddress: z.string().regex(EVM_ADDRESS_REGEX, 'Wallet address must be 0x + 40 hex characters').optional(),
    walletKey: z.string().regex(EVM_PRIVATE_KEY_REGEX, 'Private key must be 0x + 64 hex characters').optional(),
  })
  .refine((v) => v.walletAddress || v.walletKey, {
    message: 'Supply a wallet address, a private key, or a matching pair',
  });
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;

export const resolveQueueSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().min(1),
});

// --- Add payout method (where the freelancer's money actually lands) ---
// A payout method is either a BANK account (account number + IFSC/IBAN/routing) or
// a UPI id (a VPA, India's instant rail). `method` is optional for back-compat — an
// absent method is treated as BANK. Bank vs UPI fields are conditionally required.
export const addPayoutAccountSchema = z
  .object({
    label: z.string().min(1), // e.g. "HDFC savings" / "GPay"
    currency: z.enum(CURRENCIES),
    method: z.enum(PAYOUT_METHODS).optional(), // absent ⇒ BANK
    accountName: z.string().min(1).optional(),
    accountNumber: z.string().min(4).optional(), // stored masked; demo only
    bankIdentifier: z.string().min(1).optional(), // IFSC / IBAN / routing
    vpa: z.string().regex(VPA_REGEX, 'UPI id must look like name@bank').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.method === 'UPI') {
      if (!v.vpa)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vpa'], message: 'A UPI id is required for a UPI payout method' });
    } else {
      // BANK (default)
      if (!v.accountName)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountName'], message: 'An account holder name is required' });
      if (!v.accountNumber)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountNumber'], message: 'An account number is required' });
      if (!v.bankIdentifier)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bankIdentifier'], message: 'An IFSC / IBAN / routing id is required' });
    }
  });
export type AddPayoutAccountInput = z.infer<typeof addPayoutAccountSchema>;

// --- Disputes / reversals ---
export const raiseDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().min(1),
});
export type RaiseDisputeInput = z.infer<typeof raiseDisputeSchema>;

export const resolveDisputeSchema = z.object({
  action: z.enum(['REFUND', 'DISMISS']),
  note: z.string().min(1),
});

export const fxQuoteQuerySchema = z.object({
  pair: z.string().length(6),
  amount: z.coerce.number().int().positive(),
});
