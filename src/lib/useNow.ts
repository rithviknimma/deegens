import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  // Zero-pad after the leading unit so the countdown doesn't change width every second.
  const mm = String(m).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  if (d > 0) return `${d}d ${h}h ${mm}m ${ss}s`;
  if (h > 0) return `${h}h ${mm}m ${ss}s`;
  return `${m}m ${ss}s`;
}
