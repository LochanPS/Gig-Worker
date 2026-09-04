// Validation-level tests for the KYC/KYB submit schemas (no DB).
import { describe, it, expect } from 'vitest';
import { kycSubmitSchema, kybSubmitSchema } from '@gigbridge/shared';

describe('kycSubmitSchema', () => {
  it('accepts a well-formed KYC submission', () => {
    const r = kycSubmitSchema.parse({ panOrTaxId: 'ABCDE1234F', documentType: 'PAN', documentRef: 'scan-001' });
    expect(r.panOrTaxId).toBe('ABCDE1234F');
  });

  it('rejects an empty document reference', () => {
    expect(() => kycSubmitSchema.parse({ panOrTaxId: 'X', documentType: 'PAN', documentRef: '' })).toThrow();
  });
});

describe('kybSubmitSchema', () => {
  it('accepts a well-formed KYB submission', () => {
    const r = kybSubmitSchema.parse({ legalName: 'Novatek GmbH', regNumber: 'HRB-1', country: 'DE' });
    expect(r.country).toBe('DE');
  });

  it('rejects a non 2-letter country', () => {
    expect(() => kybSubmitSchema.parse({ legalName: 'X', regNumber: 'Y', country: 'DEU' })).toThrow();
  });
});
