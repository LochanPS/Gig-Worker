-- Escrow mode (FR-2.2): fund the escrow at gig start and release on work
-- approval, instead of always settling straight through on confirm.
-- Additive: existing rows default to INSTANT, the previous behaviour.
CREATE TYPE "EscrowMode" AS ENUM ('INSTANT', 'HOLD');

ALTER TABLE "Payment" ADD COLUMN "escrowMode" "EscrowMode" NOT NULL DEFAULT 'INSTANT';
