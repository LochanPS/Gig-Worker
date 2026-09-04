import { hub } from "../ws/hub.js";
import { computeMetrics } from "./metrics.js";

// Pushes metrics.tick to admins every 5s (BUILD_CONTRACTS §5).
let timer: NodeJS.Timeout | null = null;

export function startMetricsTicker(): void {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      const metrics = await computeMetrics();
      hub.toAdmins({ type: "metrics.tick", metrics });
    } catch {
      // ignore transient DB errors during boot/reset
    }
  }, 5000);
  timer.unref?.();
}

export function stopMetricsTicker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
