import { THRESHOLDS } from '@gigbridge/shared';
import { formatMoney } from '@/lib/money';
import { PageHeader } from '@/components/PageHeader';
import { Panel } from '@/components/ui/primitives';
import { SeverityChip } from '@/components/StatusChip';
import { ActivityHeatmap } from '@/components/charts/gb/ActivityHeatmap';

type Sev = 'HIGH' | 'MEDIUM' | 'LOW';
interface Rule {
  id: string;
  severity: Sev;
  legalRef: string;
  description: string;
}
interface Group {
  jurisdiction: string;
  rules: Rule[];
}

// Read-only rule registry. The active decision engine reads the same frozen
// thresholds from @gigbridge/shared.
const REGISTRY: Group[] = [
  {
    jurisdiction: 'India',
    rules: [
      { id: 'IN-RBI-001', severity: 'HIGH', legalRef: 'FEMA 1999, Sch. III', description: 'Every inward remittance must carry a valid FEMA purpose code.' },
      { id: 'IN-RBI-002', severity: 'HIGH', legalRef: 'Income-tax Act, Rule 114B', description: `A verified PAN is required for a resident payout at or above ${formatMoney(THRESHOLDS.IN_RBI_002_PAN_REQUIRED_INR, 'INR')}.` },
      { id: 'IN-LRS-001', severity: 'MEDIUM', legalRef: 'RBI LRS', description: `Cumulative outward remittance is capped at ${formatMoney(THRESHOLDS.IN_LRS_001_ANNUAL_CAP_USD, 'USD')} per financial year.` },
    ],
  },
  {
    jurisdiction: 'European Union',
    rules: [
      { id: 'EU-AML-001', severity: 'MEDIUM', legalRef: 'Directive (EU) 2015/849', description: `Enhanced due diligence is triggered at or above ${formatMoney(THRESHOLDS.EU_AML_001_EDD_EUR, 'EUR')}.` },
      { id: 'EU-AML-002', severity: 'HIGH', legalRef: 'Directive (EU) 2015/849, Art. 33', description: 'A suspicious activity report is filed where an established pattern indicates layering.' },
    ],
  },
  {
    jurisdiction: 'United States',
    rules: [
      { id: 'US-OFAC-001', severity: 'HIGH', legalRef: 'OFAC SDN List', description: 'Both parties are screened against the sanctions list on every transfer. A match blocks settlement.' },
    ],
  },
  {
    jurisdiction: 'Platform',
    rules: [
      { id: 'GB-VEL-001', severity: 'MEDIUM', legalRef: 'Platform policy', description: `More than ${THRESHOLDS.GB_VEL_001_MAX_PAYMENTS_24H} payments from one payer in 24 hours raises a velocity alert.` },
      { id: 'GB-STR-001', severity: 'HIGH', legalRef: 'Platform policy', description: `${THRESHOLDS.GB_STR_001_COUNT_72H} payments within 10 percent below a reporting threshold in 72 hours raises a structuring alert.` },
      { id: 'GB-OUT-001', severity: 'LOW', legalRef: 'Platform policy', description: `A payment above ${THRESHOLDS.GB_OUT_001_MULTIPLE_OF_AVG}x the payer average raises an outlier alert.` },
    ],
  },
];

export function AdminRules() {
  return (
    <>
      <PageHeader title="Rules" subtitle="The compliance rules evaluated on every payment, across all four jurisdictions." />
      <div className="grid gap-6">
        {REGISTRY.map((group) => (
          <Panel key={group.jurisdiction}>
            <div className="border-b border-line px-4 h-11 flex items-center">
              <h2 className="text-[13px] font-medium">{group.jurisdiction}</h2>
            </div>
            <ul>
              {group.rules.map((r) => (
                <li key={r.id} className="flex items-start gap-4 px-4 py-3.5 border-b border-line last:border-b-0">
                  <span className="num text-[12px] text-text w-[104px] shrink-0 pt-0.5">{r.id}</span>
                  <span className="shrink-0"><SeverityChip severity={r.severity} /></span>
                  <span className="flex-1">
                    <span className="text-[13px] text-text leading-[1.5]">{r.description}</span>
                    <span className="block text-[11px] text-faint mt-0.5">{r.legalRef}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel className="mt-6 p-5">
        <div className="label mb-1">Payment volume coverage</div>
        <p className="text-[12px] text-faint mb-4 max-w-[70ch]">
          Every cell is a day of payments the rule engine evaluated. Denser cells are higher-volume days.
        </p>
        <div className="h-[200px]">
          <ActivityHeatmap weeks={14} />
        </div>
      </Panel>
    </>
  );
}
