// Lightweight analytics helper: pushes to dataLayer if present, falls back to gtag, else no-op

type AnalyticsEvent = {
  event: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  [key: string]: unknown;
};

export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = { ...event, ts: Date.now() };
    // GTM dataLayer
    const w = window as unknown as { dataLayer?: any[]; gtag?: (...args: any[]) => void };
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push(payload);
      return;
    }
    // gtag fallback (GA4)
    if (typeof w.gtag === 'function') {
      w.gtag('event', event.event, payload);
      return;
    }
    // Silent no-op otherwise
  } catch {
    // swallow
  }
}

// Specific helpers
export const analytics = {
  sandboxOpened(source: 'nav' | 'quick_glance' | 'direct') {
    track({ event: 'sandbox_opened', category: 'sandbox', action: 'open', label: source });
  },
  presetChanged(presetKey: string) {
    track({ event: 'sandbox_preset_changed', category: 'sandbox', action: 'preset', label: presetKey });
  },
  windowChanged(days: number) {
    track({ event: 'sandbox_window_changed', category: 'sandbox', action: 'window', value: days });
  },
  csvExported(presetKey: string, days: number) {
    track({ event: 'sandbox_csv_exported', category: 'sandbox', action: 'export', label: presetKey, value: days });
  },
  quickGlanceClicked(presetKey: string | null, delta: number) {
    track({ event: 'quick_glance_clicked', category: 'sandbox', action: 'open', label: presetKey ?? 'unknown', value: delta });
  }
};


