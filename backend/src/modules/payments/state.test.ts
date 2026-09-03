import { describe, it, expect } from 'vitest';
import { canTransition, assertTransition, isTerminal, TIMELINE_STEPS } from './state.js';

describe('payment state machine', () => {
  it('allows the happy path DRAFT -> COMPLETED', () => {
    const path = ['DRAFT', 'COMPLIANCE_CHECK', 'RATE_LOCKED', 'FUNDED', 'SETTLING', 'COMPLETED'] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('rejects skipping compliance', () => {
    expect(canTransition('DRAFT', 'FUNDED')).toBe(false);
  });

  it('rejects releasing a rejected payment', () => {
    expect(canTransition('REJECTED', 'COMPLETED')).toBe(false);
  });

  it('allows a flagged payment to proceed after admin approval', () => {
    expect(canTransition('FLAGGED', 'RATE_LOCKED')).toBe(true);
    expect(canTransition('FLAGGED', 'REJECTED')).toBe(true);
  });

  it('allows refund from FUNDED and SETTLING only', () => {
    expect(canTransition('FUNDED', 'REFUNDED')).toBe(true);
    expect(canTransition('SETTLING', 'REFUNDED')).toBe(true);
    expect(canTransition('COMPLETED', 'REFUNDED')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal('REJECTED')).toBe(true);
    expect(isTerminal('REFUNDED')).toBe(true);
    expect(isTerminal('DRAFT')).toBe(false);
  });

  it('throws on an illegal transition', () => {
    expect(() => assertTransition('COMPLETED', 'DRAFT')).toThrow();
  });

  it('has a 7-step canonical timeline', () => {
    expect(TIMELINE_STEPS).toHaveLength(7);
    expect(TIMELINE_STEPS[0].key).toBe('CREATED');
    expect(TIMELINE_STEPS.at(-1)?.key).toBe('CREDITED');
  });
});
