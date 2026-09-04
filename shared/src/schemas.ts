// Zod request/response schemas — the wire contract (BUILD_CONTRACTS §4).
import { z } from 'zod';
import { ROLES, CURRENCIES, PURPOSE_CODES, ESCROW_MODES, CADENCES } from './enums.js';

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

export const resolveQueueSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().min(1),
});

// --- Add payout method (where the freelancer's money actually lands) ---
export const addPayoutAccountSchema = z.object({
  label: z.string().min(1), // e.g. "HDFC savings"
  currency: z.enum(CURRENCIES),
  accountName: z.string().min(1),
  accountNumber: z.string().min(4), // stored masked; demo only
  bankIdentifier: z.string().min(1), // IFSC / IBAN / routing
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
