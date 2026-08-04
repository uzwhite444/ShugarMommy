/**
 * Where the visitor came from — captured once per session and attached to
 * the booking, so the admin can see which channel actually brings clients.
 * No cookies, no third-party trackers: a single sessionStorage entry.
 */

const KEY = 'shugarmommy-source';

/** Turns a referrer host into a friendly channel name. */
function channelFromReferrer(referrer: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host === window.location.hostname) return null;
    if (/instagram|ig\.me/.test(host)) return 'Instagram';
    if (/t\.me|telegram/.test(host)) return 'Telegram';
    if (/google\./.test(host)) return 'Google';
    if (/yandex\./.test(host)) return 'Яндекс';
    if (/facebook|fb\.com/.test(host)) return 'Facebook';
    if (/tiktok/.test(host)) return 'TikTok';
    if (/youtube|youtu\.be/.test(host)) return 'YouTube';
    return host;
  } catch {
    return null;
  }
}

/**
 * Reads UTM tags / referrer on the first page of the session and remembers
 * the result. Safe to call on every mount.
 */
export function captureSource(): void {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');

    let source: string;
    if (utmSource) {
      source = [utmSource, utmMedium, utmCampaign].filter(Boolean).join(' / ');
    } else {
      source = channelFromReferrer(document.referrer) ?? 'Прямой заход';
    }
    sessionStorage.setItem(KEY, source.slice(0, 120));
  } catch {
    // Private mode / storage disabled — attribution is simply skipped.
  }
}

export function getSource(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
