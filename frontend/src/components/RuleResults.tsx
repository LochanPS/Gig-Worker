// Per-rule compliance results — the visible proof that a deterministic engine,
// not a model, produced the verdict. The decision object already carries every
// rule's PASS/FAIL with its jurisdiction and legal basis (ComplianceDecision
// .ruleResults); this renders it as a tick list instead of leaving it to the
// compliance PDF.
import type { RuleResult } from '@gigbridge/shared';

const JURISDICTION_LABEL: Record<string, string> = {
  INDIA: 'India',
  EU: 'EU',
  US: 'US',
  PLATFORM: 'Platform',
};

/** A failed BLOCK rule is what rejects a payment; a failed FLAG rule sends it to review. */
function toneOf(r: RuleResult): string {
  if (r.passed) return 'pass';
  return r.severity === 'BLOCK' ? 'block' : r.severity === 'FLAG' ? 'flag' : 'info';
}

export default function RuleResults({ results, title = 'Rules screened' }: { results: RuleResult[]; title?: string }) {
  if (!results?.length) return null;
  const failed = results.filter((r) => !r.passed);
  // Failures first: on a REJECT/FLAG the reason should be the first thing read.
  const ordered = [...failed, ...results.filter((r) => r.passed)];
  const jurisdictions = [...new Set(results.map((r) => JURISDICTION_LABEL[r.jurisdiction] ?? r.jurisdiction))];

  return (
    <div className="rules-panel">
      <div className="rules-head">
        <span className="label">{title}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {results.length - failed.length}/{results.length} passed · {jurisdictions.join(' + ')}
        </span>
      </div>
      <ul className="rulelist">
        {ordered.map((r) => (
          <li key={r.ruleId} className={`ruleitem ${toneOf(r)}`}>
            <span className="rulemark" aria-hidden="true">{r.passed ? '✓' : '✕'}</span>
            <div className="rulebody">
              <div className="ruletop">
                <span className="mono ruleid">{r.ruleId}</span>
                <span className="rulejur">{JURISDICTION_LABEL[r.jurisdiction] ?? r.jurisdiction}</span>
                {!r.passed && <span className={`rulesev ${toneOf(r)}`}>{r.severity}</span>}
              </div>
              <div className="rulemsg">{r.message}</div>
              <div className="ruleref muted">{r.legalRef}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
