import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// Minimal token-styled toaster for transient background events (e.g. an incoming
// payment). See INTEGRATION_LOG.txt: stands in for Sonner, which was not present.
interface Toast {
  id: number;
  title: string;
  body?: string;
}

interface ToastValue {
  push: (title: string, body?: string) => void;
}

const Ctx = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const reduce = useReducedMotion();
  const nextId = useRef(1);

  const push = useCallback((title: string, body?: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, title, body }].slice(-4));
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2.5rem)]" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="border border-line bg-raised px-3.5 py-3"
            >
              <div className="text-[13px] text-text">{t.title}</div>
              {t.body ? <div className="text-[12px] text-muted mt-0.5">{t.body}</div> : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastValue {
  const v = useContext(Ctx);
  // Toaster is optional; no-op if not mounted.
  return v ?? { push: () => {} };
}

/** Fires a toast when `signal` changes to a new truthy value. */
export function useToastOnChange(signal: string | null, title: string, body?: string) {
  const { push } = useToast();
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (signal && signal !== seen.current) {
      seen.current = signal;
      push(title, body);
    }
  }, [signal, title, body, push]);
}
