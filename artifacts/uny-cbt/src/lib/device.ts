const DEVICE_ID_KEY = "uny-cbt:device-id";

/**
 * Anonymous device identity — no login system. A UUID is generated once per
 * browser/device and persisted in localStorage, then sent as the
 * `X-Anon-Id` header on every progress-related API call so attempts and
 * wrong-answer history can be scoped to a device without an account.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
