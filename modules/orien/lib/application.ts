export type FieldErrors = Record<string, string | undefined>;

export type Application = {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  country: string;
  flight: string;
  seatClass: string;
  medical: string;
  referral: string;
  consent: boolean;
  updates: boolean;
  avatarUrl?: string;
  authProvider?: "google" | "github" | "credentials" | "demo";
  githubUsername?: string;
  bio?: string;
};

export const PASSWORD_RULES = [
  { id: "len", label: "8+ characters", test: (v: string) => v.length >= 8 },
  { id: "upper", label: "uppercase", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "lowercase", test: (v: string) => /[a-z]/.test(v) },
  { id: "digit", label: "number", test: (v: string) => /[0-9]/.test(v) },
];

export function passwordScore(value: string) {
  const passed = PASSWORD_RULES.filter((rule) => rule.test(value)).length;
  const bonus = value.length >= 12 && /[^A-Za-z0-9]/.test(value) ? 1 : 0;
  return Math.min(passed + bonus, 5);
}

export function passwordLabel(score: number) {
  return ["Empty", "Weak", "Fair", "Good", "Strong", "Hardened"][score] ?? "Weak";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function validate(app: Application, touched: Record<string, boolean>): FieldErrors {
  const e: FieldErrors = {};

  if (!app.fullName.trim()) e.fullName = "Required for your flight manifest.";
  else if (app.fullName.trim().length < 3) e.fullName = "Enter your full legal name.";
  else if (!/^[A-Za-zÀ-ÿ' .-]+$/.test(app.fullName.trim()))
    e.fullName = "Letters, spaces, hyphens and apostrophes only.";

  if (!app.email.trim()) e.email = "We send clearance results here.";
  else if (!EMAIL.test(app.email.trim())) e.email = "That address is not valid.";

  if (!app.password) e.password = "Choose a passphrase.";
  else if (passwordScore(app.password) < 4)
    e.password = "Does not meet the four rules below.";

  if (!app.confirm) e.confirm = "Confirm your passphrase.";
  else if (app.confirm !== app.password) e.confirm = "Passphrases do not match.";

  if (!app.country) e.country = "Select your country of residence.";

  if (!app.consent) e.consent = "You must accept the consent packet to apply.";

  return Object.fromEntries(
    Object.entries(e).filter(([key]) => touched[key] || key === "consent"),
  );
}

export function isComplete(app: Application) {
  return Object.keys(validate(app, new Proxy({}, { get: () => true }) as never)).length === 0;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function referenceCode(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    hash = Math.imul(hash ^ (hash >>> 13), 2654435761);
    out += ALPHABET[Math.abs(hash) % ALPHABET.length];
  }
  return `BE-${out}`;
}
