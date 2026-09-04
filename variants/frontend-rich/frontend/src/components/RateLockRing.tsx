import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, useReducedMotion, animate } from 'motion/react';

const SIZE = 132;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function RateLockRing({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const reduce = useReducedMotion();
  const total = 10 * 60;
  const progress = useMotionValue(1);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const end = new Date(expiresAt).getTime();
    const left = Math.max(0, (end - Date.now()) / 1000);
    progress.set(left / total);
    const controls = reduce
      ? null
      : animate(progress, 0, { duration: left, ease: 'linear' });

    const id = window.setInterval(() => {
      const secs = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        window.clearInterval(id);
        onExpire?.();
      }
    }, 1000);

    return () => {
      controls?.stop();
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, reduce]);

  const offset = useTransform(progress, (p) => C * (1 - p));
  const urgent = remaining <= 60;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--color-line)" strokeWidth={STROKE} />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={urgent ? 'var(--color-warn)' : 'var(--color-accent)'}
          strokeWidth={STROKE}
          strokeDasharray={C}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`num text-[26px] ${urgent ? 'text-warn' : 'text-text'}`}>
          {mm}:{ss}
        </span>
        <span className="label mt-1 text-[10px]">Rate lock</span>
      </div>
    </div>
  );
}
