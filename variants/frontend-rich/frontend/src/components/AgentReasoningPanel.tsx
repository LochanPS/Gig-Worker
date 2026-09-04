import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Button } from './ui/primitives';

// Types the compliance explanation at a pace that leaves the presenter room to narrate.
export function AgentReasoningPanel({
  text,
  charsPerSecond = 45,
  onDone,
}: {
  text: string;
  charsPerSecond?: number;
  onDone?: () => void;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? text.length : 0);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    if (reduce) {
      setShown(text.length);
      onDone?.();
      return;
    }
    setShown(0);
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - started) / 1000;
      const next = Math.min(Math.floor(elapsed * charsPerSecond), text.length);
      setShown(next);
      if (next < text.length) {
        raf = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, charsPerSecond, reduce]);

  const complete = shown >= text.length;

  return (
    <div className="border border-line bg-bg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="label">Agent reasoning</span>
        {!complete ? (
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              setShown(text.length);
              if (!doneRef.current) {
                doneRef.current = true;
                onDone?.();
              }
            }}
          >
            Skip
          </Button>
        ) : null}
      </div>
      <p className="text-[13px] text-text leading-[1.65] min-h-[72px] whitespace-pre-wrap">
        {text.slice(0, shown)}
        {!complete ? <span className="text-accent">|</span> : null}
      </p>
    </div>
  );
}
