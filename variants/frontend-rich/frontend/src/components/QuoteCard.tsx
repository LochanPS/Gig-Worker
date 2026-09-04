import type { FxQuote } from '@gigbridge/shared';
import { Money } from './Money';
import { Panel } from './ui/primitives';

export function QuoteCard({ quote, srcCurrency, dstCurrency }: { quote: FxQuote; srcCurrency: string; dstCurrency: string }) {
  return (
    <Panel className="p-4">
      <div className="label mb-3">Live quote</div>
      <dl className="flex flex-col gap-2.5">
        <Row label="Mid-market rate">
          <span className="num text-[13px]">
            1 {srcCurrency} = {quote.midRate.toFixed(4)} {dstCurrency}
          </span>
        </Row>
        <Row label="Platform fee, 0.75 percent">
          <Money minor={quote.feeMinor} currency={srcCurrency} />
        </Row>
        <Row label="Network estimate">
          <Money minor={quote.gasEstimateMinor} currency={srcCurrency} />
        </Row>
      </dl>
      <div className="mt-4 pt-4 border-t border-line">
        <div className="label mb-1.5">Payee receives</div>
        <Money minor={quote.payeeReceivesMinor} currency={dstCurrency} size="xl" className="text-ok" />
      </div>
      <p className="mt-3 text-[11px] text-faint">Minimum fee is 1 USD equivalent. Rate holds for 10 minutes.</p>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
