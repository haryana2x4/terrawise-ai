import { useEffect, useState } from "react";
import ApplicationReceipt from "@/components/ApplicationReceipt";
import SignInCard from "@/components/SignInCard";
import SignupCard from "@/components/SignupCard";
import {
  isSignedOut,
  loadHeld,
  setSignedOut,
  type Held,
} from "@/lib/application-store";
import type { Application } from "@/lib/application";

type Tab = "signin" | "signup";

export default function LoginPortal() {
  const [tab, setTab] = useState<Tab>("signin");
  const [held, setHeld] = useState<Held | null>(null);
  const [draft, setDraft] = useState<Application | undefined>(undefined);
  const [amending, setAmending] = useState(false);

  useEffect(() => {
    const record = loadHeld();
    if (record && !isSignedOut()) setHeld(record);
  }, []);

  const signIn = (record: Held) => {
    setHeld(record);
    setSignedOut(false);
    setAmending(false);
  };

  const signOut = () => {
    setSignedOut(true);
    setHeld(null);
    setDraft(undefined);
    setAmending(false);
    setTab("signin");
  };

  if (held && !amending) {
    return (
      <div className="hud-corner panel grain relative overflow-hidden rounded-2xl">
        <div className="relative z-10">
          <ApplicationReceipt
            held={held}
            onAmend={() => {
              setDraft(held.app);
              setAmending(true);
              setTab("signup");
            }}
            onSignOut={signOut}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#f0b64a12] to-transparent" />
      </div>
    );
  }

  return (
    <div className="hud-corner panel grain relative overflow-hidden rounded-2xl">
      <div
        role="tablist"
        aria-label="Field Shift farmer portal access"
        className="relative z-10 grid grid-cols-2 gap-1 border-b border-zinc-800 bg-[#06101ea8] p-1.5"
      >
        {(
          [
            ["signin", "🌾 Farmer Sign In"],
            ["signup", "🛰️ Register Farm"],
          ] as [Tab, string][]
        ).map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              type="button"
              id={`tab-${id}`}
              aria-selected={active}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={`relative rounded-xl px-4 py-2.5 text-[12px] font-mono font-bold tracking-[0.14em] uppercase transition-all ${
                active
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  : "text-zinc-400 hover:bg-[#0c1a2e] hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="relative z-10">
        {tab === "signin" ? (
          <div role="tabpanel" id="panel-signin" aria-labelledby="tab-signin">
            <SignInCard onSignedIn={signIn} onCreateAccount={() => setTab("signup")} />
          </div>
        ) : (
          <div role="tabpanel" id="panel-signup" aria-labelledby="tab-signup">
            {held ? (
              <p className="border-b border-[var(--hairline)] bg-[#0d1523a8] px-5 py-3 text-[12px] text-muted-foreground sm:px-7">
                An application is on file from this device under reference{" "}
                <span className="readout text-foreground">{held.ref}</span>. Submitting below replaces
                it.
              </p>
            ) : null}
            {amending ? (
              <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] bg-[#0d1523a8] px-5 py-3 text-[12px] sm:px-7">
                <span className="text-muted-foreground">
                  Editing the application stored under{" "}
                  <span className="readout text-foreground">{held?.ref}</span>.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAmending(false);
                    setDraft(undefined);
                  }}
                  className="font-mono text-[10px] tracking-[0.14em] text-primary uppercase transition-colors hover:text-foreground"
                >
                  cancel
                </button>
              </div>
            ) : null}
            <SignupCard
              initial={draft}
              onSubmitted={(record) => {
                signIn(record);
                setDraft(undefined);
              }}
            />
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#f0b64a12] to-transparent" />
    </div>
  );
}
