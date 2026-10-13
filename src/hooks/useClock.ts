import { useEffect, useState } from "react";
import { clockOf, type Clock } from "../lib/available-now";

/**
 * The time of day and weekday by the device's clock, for "available right now".
 * Checked once a minute; the returned object only changes when the time of day
 * or the weekday does, so what depends on it isn't recomputed every minute.
 */
export function useClock(): Clock {
  const [clock, setClock] = useState(() => clockOf(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      const next = clockOf(new Date());
      setClock((current) => (current.time === next.time && current.weekday === next.weekday ? current : next));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  return clock;
}
