import type { FxQuote } from '@gigbridge/shared';
import { formatMoney, retentionPct, savingsVsIncumbent } from '@/lib/money';
import { Panel } from './ui/primitives';

// Typography only. No progress bar, no filled track.
export function FeeBreakdown({ quote, srcCurrency }: { quote: FxQuote; srcCurrency: string }) {
  const incumbent = quote.incumbentFeeMinor;
  const ours = quote.feeMinor;
  const saved = savingsVsIncumbent(quote.srcAmountMinor, ours);
  const kept = retentionPct(quote.srcAmountMinor, ours, quote.gasEstimateMinor);

  return (
    <Panel className="p-4">
      <div className="label mb-3">Cost comparison</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[12px] text-muted mb-1">Typical intermediary</div>
          <div className="num text-[20px] text-muted line-through decoration-danger/70">
            {formatMoney(incumbent, srcCurrency)}
          </div>
        </div>
        <div>
          <div className="text-[12px] text-muted mb-1">GigBridge</div>
          <div className="num text-[20px] text-ok">{formatMoney(ours, srcCurrency)}</div>
        </div>
      </div>
      <p className="mt-4 pt-4 border-t border-line text-[13px] text-text leading-[1.5]">
        This payee keeps <span className="num text-ok">{kept.toFixed(2)} percent</span> of the gross. That is{' '}
        <span className="num">{formatMoney(saved, srcCurrency)}</span> that stays with them instead of going to
        intermediaries.
      </p>
    </Panel>
  );
}
