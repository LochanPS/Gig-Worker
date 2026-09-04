// Rule-id -> alert taxonomy. Kept separate so it's unit-testable without DB/ws.
import type { AlertType, AlertSeverity } from '@gigbridge/shared';

export const RULE_TO_ALERT: Record<string, { type: AlertType; severity: AlertSeverity }> = {
  'GB-VEL-001': { type: 'VELOCITY', severity: 'MEDIUM' },
  'GB-STR-001': { type: 'STRUCTURING', severity: 'HIGH' },
  'GB-OUT-001': { type: 'OUTLIER', severity: 'MEDIUM' },
  'US-OFAC-001': { type: 'SANCTIONS', severity: 'HIGH' },
};

// Alias used by tests.
export const RULE_TO_ALERT_FOR_TEST = RULE_TO_ALERT;
