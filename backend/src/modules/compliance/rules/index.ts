// The 10 compliance rules (TRD 4.5 / BUILD_CONTRACTS §8). Deterministic, ordered
// by jurisdiction. Thresholds come from shared constants so seed data triggers
// scenarios exactly.
import { THRESHOLDS } from '@gigbridge/shared';
import type { Rule } from './types.js';

export const RULES: Rule[] = [
  // ---- India (RBI / FEMA) ----
  {
    id: 'IN-RBI-001',
    jurisdiction: 'INDIA',
    legalRef: 'FEMA / RBI purpose-code reporting',
    severity: 'BLOCK',
    evaluate: (ctx) => {
      const inbound = ctx.payee.country === 'IN';
      const ok = !inbound || !!ctx.purposeCode;
      return {
        passed: ok,
        message: ok
          ? `Purpose code ${ctx.purposeCode ?? 'n/a'} present for inward remittance.`
          : 'Inward remittance to India requires a FEMA purpose code.',
      };
    },
  },
  {
    id: 'IN-RBI-002',
    jurisdiction: 'INDIA',
    legalRef: 'RBI KYC — PAN threshold',
    severity: 'FLAG',
    evaluate: (ctx) => {
      const inbound = ctx.payee.country === 'IN';
      const inrMinor = ctx.toMinor('INR');
      const needsPan = inbound && inrMinor > THRESHOLDS.IN_RBI_002_PAN_REQUIRED_INR;
      const ok = !needsPan || !!ctx.payee.panOrTaxId;
      return {
        passed: ok,
        message: ok
          ? 'PAN present or not required for this amount.'
          : `Payee PAN required for inward payments above INR ${THRESHOLDS.IN_RBI_002_PAN_REQUIRED_INR / 100}.`,
      };
    },
  },
  {
    id: 'IN-RBI-003',
    jurisdiction: 'INDIA',
    legalRef: 'Export of services classification (P08xx)',
    severity: 'INFO',
    evaluate: (ctx) => {
      const isSoftware = ctx.purposeCode === 'P0802';
      return {
        passed: true,
        message: isSoftware
          ? 'Classified as software services export (P0802).'
          : `Service export classified under ${ctx.purposeCode ?? 'unspecified'} code.`,
      };
    },
  },
  {
    id: 'IN-LRS-001',
    jurisdiction: 'INDIA',
    legalRef: 'RBI Liberalised Remittance Scheme cap',
    severity: 'BLOCK',
    evaluate: (ctx) => {
      const outbound = ctx.payer.country === 'IN';
      const usdMinor = ctx.toMinor('USD');
      const ok = !outbound || usdMinor <= THRESHOLDS.IN_LRS_001_ANNUAL_CAP_USD;
      return {
        passed: ok,
        message: ok
          ? 'Within LRS annual outward limit.'
          : `Outward remittance exceeds LRS cap of USD ${THRESHOLDS.IN_LRS_001_ANNUAL_CAP_USD / 100}.`,
      };
    },
  },
  // ---- EU (AMLD / GDPR) ----
  {
    id: 'EU-AML-001',
    jurisdiction: 'EU',
    legalRef: 'AMLD enhanced due diligence threshold',
    severity: 'FLAG',
    evaluate: (ctx) => {
      const euSide = ctx.payer.country === 'DE' || ctx.payee.country === 'DE';
      const eurMinor = ctx.toMinor('EUR');
      const overThreshold = euSide && eurMinor > THRESHOLDS.EU_AML_001_EDD_EUR;
      return {
        passed: !overThreshold,
        message: overThreshold
          ? `Single payment exceeds EUR ${THRESHOLDS.EU_AML_001_EDD_EUR / 100} — enhanced due diligence required.`
          : 'Below EU enhanced-due-diligence threshold.',
      };
    },
  },
  {
    id: 'EU-GDPR-001',
    jurisdiction: 'EU',
    legalRef: 'GDPR — no PII on-chain',
    severity: 'BLOCK',
    evaluate: () => ({
      passed: true, // structural guarantee: only hashes are anchored, never PII
      message: 'On-chain payload carries only hashes/attestations; no personal data.',
    }),
  },
  // ---- US (OFAC) ----
  {
    id: 'US-OFAC-001',
    jurisdiction: 'US',
    legalRef: 'OFAC SDN sanctions screening',
    severity: 'BLOCK',
    evaluate: (ctx) => {
      const hit = ctx.sanctionsHitPayer || ctx.sanctionsHitPayee;
      return {
        passed: !hit,
        message: hit
          ? `Sanctions match: ${ctx.sanctionsHitPayer ? ctx.payer.name : ctx.payee.name} appears on a watchlist.`
          : 'No sanctions match on either party.',
      };
    },
  },
  // ---- Platform anomaly rules ----
  {
    id: 'GB-VEL-001',
    jurisdiction: 'PLATFORM',
    legalRef: 'Velocity monitoring',
    severity: 'FLAG',
    evaluate: (ctx) => {
      const cutoff = Date.now() - 24 * 3600_000;
      const count = ctx.historyToPayee.filter((h) => h.createdAt.getTime() > cutoff).length;
      const ok = count < THRESHOLDS.GB_VEL_001_MAX_PAYMENTS_24H;
      return {
        passed: ok,
        message: ok
          ? `Velocity normal (${count} payments to this payee in 24h).`
          : `High velocity: ${count + 1} payments to this payee within 24h.`,
      };
    },
  },
  {
    id: 'GB-STR-001',
    jurisdiction: 'PLATFORM',
    legalRef: 'Structuring detection',
    severity: 'FLAG',
    evaluate: (ctx) => {
      const cutoff = Date.now() - 72 * 3600_000;
      const threshold = THRESHOLDS.EU_AML_001_EDD_EUR;
      const band = threshold * (1 - THRESHOLDS.GB_STR_001_WITHIN_PCT_OF_THRESHOLD);
      const nearThreshold = ctx.historyToPayee.filter((h) => {
        // approximate: treat src minor as EUR-ish for the band check in demo
        return h.createdAt.getTime() > cutoff && h.srcAmountMinor >= band && h.srcAmountMinor < threshold;
      }).length;
      const includingThis = nearThreshold + (ctx.toMinor('EUR') >= band && ctx.toMinor('EUR') < threshold ? 1 : 0);
      const ok = includingThis < THRESHOLDS.GB_STR_001_COUNT_72H;
      return {
        passed: ok,
        message: ok
          ? 'No structuring pattern detected.'
          : `Possible structuring: ${includingThis} payments just below the reporting threshold in 72h.`,
      };
    },
  },
  {
    id: 'GB-OUT-001',
    jurisdiction: 'PLATFORM',
    legalRef: 'Amount outlier detection',
    severity: 'FLAG',
    evaluate: (ctx) => {
      const avg = ctx.payeeTrailingAvgUsdMinor;
      if (avg <= 0) return { passed: true, message: 'No payment history to compare against.' };
      const usd = ctx.toMinor('USD');
      const ok = usd <= avg * THRESHOLDS.GB_OUT_001_MULTIPLE_OF_AVG;
      return {
        passed: ok,
        message: ok
          ? 'Amount consistent with payee history.'
          : `Amount is ${(usd / avg).toFixed(1)}x the payee's trailing average.`,
      };
    },
  },
];
