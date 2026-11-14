import { MANIFEST } from "@/data/site";
import { referenceCode, type Application } from "@/lib/application";

const STORAGE_KEY = "beyond-earth.application.v1";
const SESSION_KEY = "beyond-earth.session.v1";

export type Held = {
  ref: string;
  submittedAt: string;
  app: Application;
  /** SHA-256 of the passphrase; the plaintext is never persisted. */
  pwHash: string;
  /** True when the record was rebuilt from a reference code on a fresh device. */
  restored?: boolean;
};

export function loadHeld(): Held | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Held;
    if (!parsed?.ref || !parsed?.app) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveHeld(record: Held): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable — the session still completes in memory */
  }
}

export function clearHeld(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function isSignedOut(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === "signed-out";
  } catch {
    return false;
  }
}

export function setSignedOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(SESSION_KEY, "signed-out");
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function hashPassphrase(passphrase: string): Promise<string> {
  const bytes = new TextEncoder().encode(passphrase);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function emailMatches(app: Application, email: string): boolean {
  return app.email.trim().toLowerCase() === email.trim().toLowerCase();
}

export function referenceMatches(held: Held, code: string): boolean {
  return held.ref.toLowerCase() === code.trim().toLowerCase();
}

/**
 * Rebuilds a candidate file from a reference code (or a flight code) and the
 * email it was issued against. The reference is derived from the email and the
 * flight, so the pair can be checked without a server.
 */
export function restoreHeld(email: string, secret: string): Held | null {
  const address = email.trim().toLowerCase();
  const code = secret.trim().toUpperCase();
  if (!address || !code) return null;
  const flight = MANIFEST.find((f) => referenceCode(address + f.code) === code);
  if (!flight) return null;
  const app: Application = {
    fullName: "",
    email: address,
    password: "",
    confirm: "",
    country: "",
    flight: flight.code,
    seatClass: "orbital",
    medical: "none",
    referral: "",
    consent: true,
    updates: false,
  };
  return {
    ref: referenceCode(address + flight.code),
    submittedAt: new Date().toISOString(),
    app,
    pwHash: "",
    restored: true,
  };
}
