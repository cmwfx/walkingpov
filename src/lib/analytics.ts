export const GA_MEASUREMENT_ID = 'G-2G7MG61YH5';

type AnalyticsEvent =
  | 'page_view'
  | 'video_detail_view'
  | 'preview_start'
  | 'preview_limit_reached'
  | 'premium_cta_click'
  | 'download_link_click'
  | 'sign_up_start'
  | 'sign_up'
  | 'email_verified'
  | 'login'
  | 'begin_checkout'
  | 'card_checkout_outbound_click'
  | 'gift_card_outbound_click'
  | 'payment_proof_submitted';

type EventParameters = Record<string, string | number | boolean>;
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

const gaClientIdPattern = /^[0-9]{1,20}\.[0-9]{1,20}$/;

export function trackAnalyticsEvent(eventName: AnalyticsEvent, parameters: EventParameters = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', eventName, parameters);
  } catch {
    // Analytics must never interrupt registration, payment, or playback flows.
  }
}

export function trackPageView(pathname: string) {
  if (typeof window === 'undefined') return;

  // Never send query parameters, video IDs, or support-ticket IDs to Analytics.
  const safePath = pathname
    .replace(/\/video\/[^/]+(?=\/|$)/, '/video/:id')
    .replace(/\/support\/[^/]+(?=\/|$)/, '/support/:id');
  const pageLocation = new URL(safePath || '/', window.location.origin).toString();
  trackAnalyticsEvent('page_view', {
    page_path: safePath || '/',
    page_location: pageLocation,
    page_title: document.title,
  });
}

export function getAnalyticsClientId(timeoutMs = 1200): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (clientId: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(typeof clientId === 'string' && gaClientIdPattern.test(clientId) ? clientId : null);
    };
    const timeout = window.setTimeout(() => finish(null), timeoutMs);

    try {
      window.gtag('get', GA_MEASUREMENT_ID, 'client_id', finish);
    } catch {
      finish(null);
    }
  });
}
