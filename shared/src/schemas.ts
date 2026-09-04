// Zod schemas for every request body in the frozen REST contract
// (BUILD_CONTRACTS.txt section 4). The backend validates against these; the
// mock server and frontend generate fixtures from them.
import { z } from "zod";
import {
  CURRENCIES,
  ROLES,
  PURPOSE_CODES,
  CORRIDORS,
  PAYOUT_PREFERENCES,
} from "./types.js";

export const roleSchema = z.enum(ROLES);
export const currencySchema = z.enum(CURRENCIES);
export const corridorSchema = z.enum(CORRIDORS);
export const purposeCodeSchema = z.enum(PURPOSE_CODES);

// Positive integer minor units.
export const minorAmountSchema = z
  .number()
  .int("amount must be an integer in minor units")
  .positive("amount must be positive");

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: roleSchema,
  country: z.string().length(2, "country must be an ISO-2 code"),
  name: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const kycSubmitSchema = z.object({
  fullName: z.string().min(1),
  panOrTaxId: z.string().min(1).optional(),
  documentRef: z.string().min(1), // mock document handle
  payoutPreference: z.enum(PAYOUT_PREFERENCES).default("AUTO_CONVERT"),
});
export type KycSubmitInput = z.infer<typeof kycSubmitSchema>;

export const kybSubmitSchema = z.object({
  legalName: z.string().min(1),
  regNumber: z.string().min(1),
  country: z.string().length(2),
});
export type KybSubmitInput = z.infer<typeof kybSubmitSchema>;

export const fxQuoteQuerySchema = z.object({
  pair: corridorSchema,
  amount: z.coerce.number().int().positive(), // minor units
});
export type FxQuoteQuery = z.infer<typeof fxQuoteQuerySchema>;

export const fxHistoryQuerySchema = z.object({
  pair: corridorSchema,
  days: z.coerce.number().int().positive().max(365).default(30),
});
export type FxHistoryQuery = z.infer<typeof fxHistoryQuerySchema>;

export const createPaymentSchema = z.object({
  payeeId: z.string().uuid(),
  srcCurrency: currencySchema,
  dstCurrency: currencySchema,
  srcAmountMinor: minorAmountSchema,
  purposeCode: purposeCodeSchema,
  invoiceRef: z.string().min(1).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const confirmPaymentSchema = z.object({
  quoteId: z.string().uuid(),
});
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

export const createInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  amountMinor: minorAmountSchema,
  currency: currencySchema,
  memo: z.string().min(1),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const resolveQueueSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().min(1),
});
export type ResolveQueueInput = z.infer<typeof resolveQueueSchema>;

export const verifyUserSchema = z.object({
  note: z.string().optional(),
});
export type VerifyUserInput = z.infer<typeof verifyUserSchema>;
