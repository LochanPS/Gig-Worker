// Zod request/response schemas — the wire contract (BUILD_CONTRACTS §4).
import { z } from 'zod';
import { ROLES, CURRENCIES, PURPOSE_CODES } from './enums.js';

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
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const confirmPaymentSchema = z.object({
  quoteId: z.string().uuid(),
});

export const createInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.enum(CURRENCIES),
  memo: z.string().min(1),
});

export const resolveQueueSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().min(1),
});

export const fxQuoteQuerySchema = z.object({
  pair: z.string().length(6),
  amount: z.coerce.number().int().positive(),
});
