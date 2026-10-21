// Courier details for a shipped order, typed by the admin or staff.

export interface TrackingInput { courierName?: string; trackingNumber?: string; trackingUrl?: string }
export interface Tracking { courierName: string | null; trackingNumber: string | null; trackingUrl: string | null }

const NUMBER = /^[A-Za-z0-9][A-Za-z0-9 ._\/-]{0,59}$/;

export const NO_TRACKING: Tracking = { courierName: null, trackingNumber: null, trackingUrl: null };
export const hasTracking = (t: Tracking) => !!(t.courierName || t.trackingNumber || t.trackingUrl);

// Cleans what was typed; the error is a message for the person who typed it. Everything is optional, but a number or link needs a courier.
export function readTracking(input: TrackingInput | undefined): { tracking: Tracking; error?: string } {
  const clean = (v?: string) => v?.trim().replace(/\s+/g, " ") || null;
  const tracking: Tracking = { courierName: clean(input?.courierName), trackingNumber: clean(input?.trackingNumber), trackingUrl: input?.trackingUrl?.trim() || null };
  if (tracking.courierName && tracking.courierName.length > 60) return { tracking, error: "The courier name is too long" };
  if (tracking.trackingNumber && !NUMBER.test(tracking.trackingNumber)) return { tracking, error: "The tracking number can only have letters, numbers, spaces and - . / _" };
  if (tracking.trackingUrl && !/^https:\/\/\S+$/.test(tracking.trackingUrl)) return { tracking, error: "The tracking link must start with https://" };
  if ((tracking.trackingNumber || tracking.trackingUrl) && !tracking.courierName) return { tracking, error: "Enter the courier name with the tracking number or link" };
  return { tracking };
}

// "Delhivery 1234567" for a short message, or empty when nothing was entered.
export const trackingText = (t: Pick<Tracking, "courierName" | "trackingNumber">) => [t.courierName, t.trackingNumber].filter(Boolean).join(" ");
