const DRIVER_CODE_KEY = "tgrr-driver-code-v1";
export const DRIVER_CHANGED_EVENT = "tgrr-driver-changed";

export function normalizeDriverCode(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export function getDriverCode(): string {
  if (typeof localStorage === "undefined") return "";
  return normalizeDriverCode(localStorage.getItem(DRIVER_CODE_KEY) ?? "");
}

export function setDriverCode(value: string): string {
  const normalized = normalizeDriverCode(value);
  if (normalized.length >= 2) {
    localStorage.setItem(DRIVER_CODE_KEY, normalized);
  } else {
    localStorage.removeItem(DRIVER_CODE_KEY);
  }
  window.dispatchEvent(new CustomEvent(DRIVER_CHANGED_EVENT, { detail: normalized }));
  return normalized;
}

export function driverScopedQueryKey(key: string): readonly [string, string] {
  return [key, getDriverCode()] as const;
}
