// Frozen compliance thresholds & fee params (docs/BUILD_CONTRACTS.txt section 8).
// Rules AND seed data both read from here so demo scenarios trigger deterministically.

export const THRESHOLDS = {
  IN_RBI_002_PAN_REQUIRED_INR: 50_000_00, // INR 50,000 in paise
  EU_AML_001_EDD_EUR: 10_000_00, // EUR 10,000 in cents
  IN_LRS_001_ANNUAL_CAP_USD: 250_000_00, // USD 250,000 in cents
  IN_PACB_001_PER_TXN_CAP_USD: 10_000_00, // USD 10,000 per-transaction PA-CB cap (INR off-ramp)
  GB_VEL_001_MAX_PAYMENTS_24H: 5,
  GB_STR_001_COUNT_72H: 3,
  GB_STR_001_WITHIN_PCT_OF_THRESHOLD: 0.1, // within 10% below EU AML threshold
  GB_OUT_001_MULTIPLE_OF_AVG: 5,
} as const;

export const FEE = {
  BPS: 75, // 0.75%
  MIN_USD_MINOR: 1_00, // USD 1.00 in cents
} as const;

export const RATE_LOCK_MINUTES = 10;

// Incumbent benchmark used for the "vs PayPal" comparison strip (9% all-in).
export const INCUMBENT_FEE_PCT = 0.09;

export const MOCK_USDC_DECIMALS = 6;
