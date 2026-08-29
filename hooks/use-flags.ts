import { useEffect, useState } from "react";
import { loadFlags, subscribeFlags, isEnabled, type FlagCode } from "@/lib/flags";

/**
 * Charge les feature flags au montage, se réabonne au realtime, et renvoie
 * un lecteur `flag(code)`. Un kill switch côté serveur re-render les consommateurs.
 */
export function useFlags() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    loadFlags().then(() => alive && setTick((n) => n + 1));
    const unsub = subscribeFlags(() => alive && setTick((n) => n + 1));
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  // tick force le recalcul de flag() à chaque changement
  void tick;
  return { flag: (code: FlagCode) => isEnabled(code) };
}
