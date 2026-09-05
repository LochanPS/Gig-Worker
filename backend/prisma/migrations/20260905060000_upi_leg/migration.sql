-- UPI leg / INR off-ramp (the last mile). Additive: a payout method can now be UPI
-- (a Virtual Payment Address) instead of a bank account, and a completed payment
-- records how the INR was delivered off-ramp. Existing rows keep BANK semantics.

-- Payout methods: BANK (default) or UPI. Bank fields become optional (UPI has none);
-- a new nullable "vpa" holds the UPI Virtual Payment Address.
ALTER TABLE "PayoutAccount" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'BANK';
ALTER TABLE "PayoutAccount" ADD COLUMN "vpa" TEXT;
ALTER TABLE "PayoutAccount" ALTER COLUMN "accountName" DROP NOT NULL;
ALTER TABLE "PayoutAccount" ALTER COLUMN "accountNumberMasked" DROP NOT NULL;
ALTER TABLE "PayoutAccount" ALTER COLUMN "bankIdentifier" DROP NOT NULL;

-- A completed INR payment records the off-ramp reference + delivery method, for the
-- FIRC document and the "credited to <vpa>" UI state.
ALTER TABLE "Payment" ADD COLUMN "payoutMethod" TEXT;
ALTER TABLE "Payment" ADD COLUMN "payoutRailRef" TEXT;
