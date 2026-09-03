import { useEffect, useRef } from 'react';
import { useRealtime } from '@/lib/realtime';
import { useToast } from '@/components/ui/toast';

// Surfaces the newest notification as a transient toast, once each.
export function RealtimeToasts() {
  const { notifications } = useRealtime();
  const { push } = useToast();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const latest = notifications[0];
    if (latest && latest.id !== seen.current) {
      seen.current = latest.id;
      push(latest.message);
    }
  }, [notifications, push]);

  return null;
}
