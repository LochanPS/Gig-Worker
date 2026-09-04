import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// One restrained burst, low particle count, accent and --ok only. Fires when
// `trigger` changes to a new truthy value, then clears itself.
const COLORS = ['var(--color-accent)', 'var(--color-ok)'];
const COUNT = 28;

export function Confetti({ trigger }: { trigger: string | null }) {
  const reduce = useReducedMotion();
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    if (trigger && trigger !== key) {
      setKey(trigger);
      const t = window.setTimeout(() => setKey(null), 1600);
      return () => window.clearTimeout(t);
    }
  }, [trigger, key]);

  if (!key || reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: COUNT }).map((_, i) => {
        const angle = (i / COUNT) * Math.PI * 2;
        const dist = 120 + (i % 5) * 26;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist - 40;
        return (
          <motion.span
            key={`${key}-${i}`}
            className="absolute left-1/2 top-1/3 h-1.5 w-1.5"
            style={{ background: COLORS[i % COLORS.length] }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x, y: y + 160, scale: 0.6, rotate: (i % 2 ? 1 : -1) * 180 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}
