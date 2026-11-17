// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG codes hook
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import { gepgCodesApi } from '../api/gepgCodes';

// static list, fetched once and shared
let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

function loadCodes(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = gepgCodesApi
      .list()
      .then((res) => {
        cache = Object.fromEntries(res.data.data.map((c) => [c.code, c.description]));
        return cache;
      })
      .catch(() => {
        // don't cache a failure, a later mount can retry
        inflight = null;
        return {} as Record<string, string>;
      });
  }
  return inflight;
}

export function useGepgCodes() {
  const [codes, setCodes] = useState<Record<string, string>>(cache ?? {});

  useEffect(() => {
    let active = true;
    loadCodes().then((c) => active && setCodes(c));
    return () => {
      active = false;
    };
  }, []);

  return (raw?: string | null): string => {
    if (!raw) return '';
    return String(raw)
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => codes[c])
      .filter(Boolean)
      .join('; ');
  };
}
