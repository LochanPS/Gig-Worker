/**
 * Zod schemas for every API request/response body. These are the runtime
 * contract; backend validates IO against them and frontend imports the
 * inferred types. Enums come from enums.ts so there is a single source.
 */

import { z } from "zod";
import {
  ALERT_TYPES,
  CURRENCIES,
  FX_PAIRS,
  PAYOUT_PREFERENCES,
  PURPOSE_CODES,
  ROLES,
} from "./enums.js";

// ---- Primitives -------------------------------------------------------------

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8).max(128);
export const countrySchema = z.string().length(2).toUpperCase();
export const currencySchema = z.enum(CURRENCIES);
export const fxPairSchema = z.enum(FX_PAIRS);
export const purposeCodeSchema = z.enum(PURPOSE_CODES);
export const positiveAmount = z.number().positive().finite();

// ---- Auth -------------------------------------------------------------------

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(ROLES),
    country: countrySchema,
    // role-specific profile fields (validated in the handler by role)
    legalName: z.string().min(1).optional(),
    regNumber: z.string().min(1).optional(),
    fullName: z.string().min(1).optional(),
  })
  .strict();
export type RegisterBody = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .strict();
export type LoginBody = z.infer<typeof loginSchema>;

// ---- Identity (KYC / KYB) ---------------------------------------------------

export const kycSubmitSchema = z
  .object({
    fullName: z.string().min(1),
    panOrTaxId: z.string().min(1).nullable().optional(),
    payoutPreference: z.enum(PAYOUT_PREFERENCES).default("AUTO_CONVERT"),
    // demo: document upload is simulated; we only carry a filename marker
    documentRef: z.string().optional(),
  })
  .strict();
export type KycSubmitBody = z.infer<typeof kycSubmitSchema>;

export const kybSubmitSchema = z
  .object({
    legalName: z.string().min(1),
    regNumber: z.string().min(1),
    authorizedSignatory: z.string().min(1),
    documentRef: z.string().optional(),
  })
  .strict();
export type KybSubmitBody = z.infer<typeof kybSubmitSchema>;

// ---- FX ---------------------------------------------------------------------

export const fxQuoteQuerySchema = z
  .object({ pair: fxPairSchema, amount: z.coerce.number().positive() })
  .strict();
export type FxQuoteQuery = z.infer<typeof fxQuoteQuerySchema>;

export const fxQuoteSchema = z.object({
  pair: fxPairSchema,
  srcCurrency: currencySchema,
  dstCurrency: currencySchema,
  srcAmount: positiveAmount,
  midRate: positiveAmount,
  feeAmount: positiveAmount,
  dstAmount: positiveAmount,
  /** what an incumbent (PayPal-style ~8%) would charge, for the demo banner. */
  incumbentFeeAmount: positiveAmount,
  lockedUntil: z.string().nullable(),
});
export type FxQuote = z.infer<typeof fxQuoteSchema>;

// ---- Payments ---------------------------------------------------------------

export const createPaymentSchema = z
  .object({
    freelancerId: z.string().min(1),
    srcCurrency: currencySchema,
    dstCurrency: currencySchema,
    srcAmount: positiveAmount,
    purposeCode: purposeCodeSchema.nullable().optional(),
    invoiceRef: z.string().nullable().optional(),
  })
  .strict()
  .refine((v) => v.srcCurrency !== v.dstCurrency, {
    message: "srcCurrency and dstCurrency must differ",
    path: ["dstCurrency"],
  });
export type CreatePaymentBody = z.infer<typeof createPaymentSchema>;

export const resolveQueueSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    note: z.string().min(1),
  })
  .strict();
export type ResolveQueueBody = z.infer<typeof resolveQueueSchema>;

// ---- Invoices ---------------------------------------------------------------

export const createInvoiceSchema = z
  .object({
    companyId: z.string().min(1),
    amount: positiveAmount,
    currency: currencySchema,
    memo: z.string().nullable().optional(),
  })
  .strict();
export type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;

// ---- Admin filters ----------------------------------------------------------

export const alertsQuerySchema = z
  .object({
    type: z.enum(ALERT_TYPES).optional(),
    resolved: z.coerce.boolean().optional(),
  })
  .strict();
export type AlertsQuery = z.infer<typeof alertsQuerySchema>;
