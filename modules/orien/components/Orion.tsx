import { useCallback, useEffect, useRef, useState } from "react";
import EndermanAvatar, {
  EndermanGlyph,
  EndermanProfile,
  type EndermanMood,
  type EndermanGesture,
} from "@/components/EndermanAvatar";
import { OrionAI } from "@/lib/orion-ai";
import { orionVoice } from "@/lib/orion-voice";
import { sound } from "@/lib/sound-effects";
import { translator, SUPPORTED_LANGUAGES, type LanguageInfo } from "@/lib/translator";

type Role = "user" | "assistant";
type Message = {
  id: string;
  role: Role;
  text: string;
  state: string;
  gesture?: EndermanGesture;
  lang?: string;
  originalText?: string;
};

const PRINCIPAL_KEY = "beyond-earth.orion.principal";
const HISTORY_KEY = "beyond-earth.orion.chat-history";

const SUGGESTIONS = [
  "How fast are we travelling at 400 km?",
  "What does the centrifuge training actually feel like?",
  "Explain orbital sunrise in simple terms",
  "Which flight has seats left right now?",
  "Tell me about the history of the Apollo program",
  "Why do you look like a Minecraft Enderman?",
  "What happens if I stare into your eyes?",
  "Dematerialize and teleport across the screen!",
];

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function renderText(text: string) {
  // Strip gesture tags if any remained in display
  const clean = text.replace(/\[gesture:[a-zA-Z0-9_-]+\]/gi, "").trim();

  return clean.split(/\n{2,}/).map((block, index) => {
    const lines = block.split("\n");
    const bullet = lines.every((line) => /^\s*[-*•]\s+/.test(line));
    if (bullet) {
      return (
        <ul key={index} className="my-1.5 space-y-1 pl-1">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400/80" />
              <span>{line.replace(/^\s*[-*•]\s+/, "")}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} className="my-1.5 first:mt-0 last:mb-0">
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </p>
    );
  });
}

function Presence({ state }: { state: "offline" | "live" | "thinking" | "speaking" }) {
  const mood: EndermanMood =
    state === "offline" ? "offline" : state === "speaking" ? "speaking" : state === "thinking" ? "thinking" : "idle";
  return (
    <div className="relative h-9 w-9 shrink-0">
      <EndermanGlyph mood={mood} />
    </div>
  );
}

export default function Orion() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<EndermanGesture>("idle");
  const [isMuted, setIsMuted] = useState(() => sound.isMuted());
  const [audioLevel, setAudioLevel] = useState(0);
  const [selectedLang, setSelectedLang] = useState<string>(() => translator.getLanguage());
  const [isListening, setIsListening] = useState<boolean>(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync translator language changes
  useEffect(() => {
    const unsub = translator.subscribe((lang) => {
      setSelectedLang(lang);
    });
    return unsub;
  }, []);

  // Voice Recognition for Chat
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      void send(selectedLang === "hi" ? "आज खाना खाया?" : selectedLang === "es" ? "¿Tienes comida hoy?" : "How fast are we travelling at 400 km?");
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const activeLang = translator.getActiveLanguageInfo();
      recognition.lang = activeLang.bcp47;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListening(true);
      sound.playChirp();
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) void send(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Sync mute state
  const toggleMute = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
    if (next) {
      orionVoice.stop();
    }
  };

  // Subscribe to real-time lip-sync to show waveform indicator in UI
  useEffect(() => {
    const unsub = orionVoice.subscribeLipSync((amp) => {
      setAudioLevel(amp);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const onGesture = (event: Event) => {
      const name = (event as CustomEvent<{ gesture?: EndermanGesture }>).detail?.gesture;
      if (name) setCurrentGesture(name);
    };
    window.addEventListener("orion:gesture", onGesture);
    return () => window.removeEventListener("orion:gesture", onGesture);
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // ignore
    }
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  // Answer handler
  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;

    setInput("");
    sound.playChirp();

    const userMsgId = uuid();
    const assistantMsgId = uuid();

    const history = messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      gesture: message.gesture,
      timestamp: Date.now(),
    }));

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: prompt, state: "completed" },
      { id: assistantMsgId, role: "assistant", text: "", state: "running" },
    ]);
    setBusy(true);
    setCurrentGesture("thinking");

    try {
      const response = await OrionAI.answer(prompt, history, selectedLang);
      const gesture = response.gesture || "nod";
      const fullText = response.text.replace(/\[gesture:[a-zA-Z0-9_-]+\]/gi, "").trim();
      setCurrentGesture(gesture);
      window.dispatchEvent(new CustomEvent("orion:gesture", { detail: { gesture } }));

      if (gesture === "teleport") {
        sound.playTeleport();
        window.dispatchEvent(new CustomEvent("orion:teleport"));
      } else if (gesture === "stare") {
        sound.playEnderStare();
      } else if (gesture === "wave") {
        sound.playGesture();
      }

      let voiceDone = false;
      let textDone = false;
      const finish = () => {
        if (!voiceDone || !textDone) return;
        setBusy(false);
        if (gesture !== "stare") setCurrentGesture("idle");
      };

      orionVoice.speak(fullText, {
        onEnd: () => {
          voiceDone = true;
          finish();
        },
        lang: response.lang || selectedLang,
      });

      const started = performance.now();
      const duration = orionVoice.durationMs(fullText);
      const reveal = (now: number) => {
        const progress = Math.min(1, (now - started) / duration);
        const count = Math.max(1, Math.ceil(fullText.length * progress));
        const done = progress >= 1;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  text: done ? fullText : fullText.slice(0, count),
                  state: done ? "completed" : "running",
                  gesture,
                  lang: response.lang || selectedLang,
                  originalText: response.originalText,
                }
              : msg,
          ),
        );
        if (!done) {
          requestAnimationFrame(reveal);
          return;
        }
        textDone = true;
        finish();
      };
      requestAnimationFrame(reveal);
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: "Telemetry packet unreadable. Standing by for orbital link retry.",
                state: "completed",
              }
            : msg,
        ),
      );
      setBusy(false);
    }
  };

  const clearChat = () => {
    orionVoice.stop();
    setMessages([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  const awaiting = busy && messages.some((message) => message.role === "assistant" && message.state === "running" && !message.text);
  const isSpeaking = (busy && !awaiting) || orionVoice.isSpeaking();
  const mood: EndermanMood = awaiting ? "thinking" : isSpeaking ? "speaking" : "idle";

  return (
    <section id="orion" className="grain relative scroll-mt-24 overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f0b64a88] to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_0%,#f0b64a14,transparent_60%)]" />
      <div className="mx-auto max-w-[1240px]">
        {/* Header Section */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="eyebrow flex items-center gap-2">
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              Virtual Mission Intelligence · Enderman Autonomous Core
            </div>
            <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
              Ask ORION Anything.
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              ORION keeps the flight board in memory and looks up anything else as you ask it.
              The words and the voice finish together. Click the figure on the page to change his gesture,
              drag him, or double-click open space and he teleports to the cursor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Global Language Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-fuchsia-700/50 bg-[#0f091c]/80 px-2.5 py-2 text-[11px] font-mono shadow-[0_0_12px_rgba(217,70,239,0.15)]">
              <span className="text-[13px]">🌐</span>
              <select
                value={selectedLang}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedLang(val);
                  translator.setLanguage(val);
                  sound.playChirp();
                }}
                className="bg-transparent font-bold text-fuchsia-200 outline-none cursor-pointer text-[11px]"
                title="Select language for ORION's answers & speech"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#090614] text-white">
                    {l.flag} {l.nativeName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  sound.playChirp();
                  orionVoice.previewVoice(selectedLang);
                }}
                className="ml-1 rounded px-2 py-0.5 bg-fuchsia-900/60 hover:bg-fuchsia-700 text-fuchsia-200 text-[10px] font-mono font-bold border border-fuchsia-500/40"
                title="Hear voice sample in this language"
              >
                🔊 Sample
              </button>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] font-mono tracking-wider uppercase transition-all ${
                isMuted
                  ? "border-red-900/60 bg-red-950/40 text-red-300"
                  : "border-fuchsia-700/60 bg-fuchsia-950/30 text-fuchsia-300 shadow-[0_0_15px_rgba(217,70,239,0.25)]"
              }`}
              title={isMuted ? "Unmute ORION Voice" : "Mute ORION Voice"}
            >
              {isMuted ? "🔇 Voice Muted" : "🔊 Voice Online"}
              {!isMuted && isSpeaking ? (
                <span className="flex items-end gap-0.5 h-3">
                  <span className="w-1 bg-fuchsia-400 animate-pulse" style={{ height: `${Math.max(20, audioLevel * 100)}%` }} />
                  <span className="w-1 bg-fuchsia-400 animate-pulse delay-75" style={{ height: `${Math.max(40, audioLevel * 85)}%` }} />
                  <span className="w-1 bg-fuchsia-400 animate-pulse delay-150" style={{ height: `${Math.max(10, audioLevel * 110)}%` }} />
                </span>
              ) : null}
            </button>

            <div className="readout rounded-xl border border-[var(--hairline)] bg-[#0a0714]/60 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span className="block text-foreground font-medium flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                ORION Online
              </span>
              <span>autonomous voxel rig · 60fps lip-sync</span>
            </div>
          </div>
        </div>

        {/* Main Panel */}
        <div className="panel cinematic-frame relative mt-10 grid gap-0 overflow-hidden rounded-3xl lg:grid-cols-[330px_1fr]">
          {/* Enderman 3D Avatar Aside */}
          <aside className="relative flex flex-col items-center gap-5 border-b border-[var(--hairline)] p-6 text-center lg:border-r lg:border-b-0 bg-[#07050e]/95">
            <div className="relative h-[270px] w-full max-w-[290px] overflow-hidden rounded-2xl border border-[#3b1d54] bg-[radial-gradient(circle_at_50%_38%,rgba(217,70,239,0.22),rgba(7,4,14,0.96)_66%)] shadow-[inset_0_0_24px_rgba(217,70,239,0.15)]">
              <EndermanAvatar
                mood={mood}
                gesture={currentGesture}
                onGestureChange={setCurrentGesture}
                interactive={true}
                showControls={true}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#07050e] to-transparent" />
            </div>

            <div className="w-full">
              <div className="flex items-center justify-between">
                <span className="readout text-[13px] tracking-[0.2em] text-foreground uppercase font-semibold">
                  ORION
                </span>
                <span className="text-[10px] font-mono tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  READY
                </span>
              </div>
              <p className="mt-1 text-left text-[11px] tracking-[0.16em] text-[#a855f7] uppercase font-mono">
                MINECRAFT ENDERMAN VOXEL RIG
              </p>
              <p className="mt-2 text-left text-[12px] leading-relaxed text-muted-foreground">
                {isSpeaking
                  ? "Transmitting spoken answer with synchronized jaw drop…"
                  : "Standing by. Click avatar to command, or ask any question below."}
              </p>
            </div>

            {/* Diagnostics Stats */}
            <div className="w-full space-y-1.5 border-t border-[#2b1c3d] pt-4 text-left font-mono">
              {[
                ["CORE", "Omniscient Knowledge Matrix"],
                ["LIP-SYNC", "Real-Time 60fps Formant"],
                ["GESTURES", "8 Spatial Kinematic Poses"],
                ["JAW RIG", "Articulated Obsidian Plate"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[11px]">
                  <span className="tracking-[0.12em] text-muted-foreground uppercase">{k}</span>
                  <span className="text-[#d8b4fe] truncate ml-2">{v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1.5 text-[11px]">
                <span className="tracking-[0.12em] text-muted-foreground uppercase">AVATAR</span>
                <EndermanProfile />
              </div>
            </div>
          </aside>

          {/* Interactive Chat Console */}
          <div className="flex min-h-[460px] flex-col bg-[#05040a]/90">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-3 text-[12px] text-muted-foreground">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                TELEMETRY LINK ACTIVE
              </div>
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={clearChat}
                  className="rounded-lg px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-[#1a102c] hover:text-zinc-200 transition-colors font-mono"
                >
                  Clear Console
                </button>
              ) : null}
            </div>

            {/* Message Stream */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7">
              {messages.length === 0 ? (
                <div className="space-y-5">
                  <div className="flex items-end gap-1.5 h-6" aria-hidden="true">
                    {[0.35, 0.8, 0.5, 1, 0.62, 0.9, 0.4].map((scale, i) => (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-fuchsia-500/80 animate-pulse"
                        style={{
                          height: `${scale * 100}%`,
                          animationDuration: `${1.1 + i * 0.13}s`,
                          animationDelay: `${i * 0.09}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div>
                    <h3 className="text-[16px] font-medium text-foreground">
                      ORION is listening. Ask anything in the cosmos.
                    </h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
                      Choose an orbital inquiry below or type any question into the uplink console:
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void send(suggestion)}
                        disabled={busy}
                        className="rounded-full border border-[#3b1d54] bg-[#0e091b]/80 px-3.5 py-2 text-[12.5px] text-[#e2d4f0] transition-all hover:border-fuchsia-500/70 hover:bg-[#1c1133] hover:text-white disabled:opacity-40"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === "user" ? "flex justify-end" : "flex gap-3"}
                  >
                    {message.role === "assistant" ? (
                      <div className="mt-0.5 shrink-0">
                        <Presence state={message.state === "running" ? "speaking" : "thinking"} />
                      </div>
                    ) : null}
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-md bg-[#1d1230] border border-[#481c6a] px-4 py-3 text-[14px] leading-relaxed text-white shadow-lg"
                          : "max-w-[92%] rounded-2xl rounded-bl-md border border-[#341d4c] bg-[#090614] px-4 py-3 text-[14px] leading-relaxed text-[#ede5f7] shadow-lg"
                      }
                    >
                      {message.role === "assistant" && !message.text ? (
                        <span className="flex items-center gap-1.5 py-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:120ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:240ms]" />
                        </span>
                      ) : (
                        <div>
                          {message.lang && message.lang !== "en" && (
                            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-mono text-emerald-400">
                              <span className="rounded bg-emerald-950/80 px-1.5 py-0.2 border border-emerald-700/50">
                                🌐 {message.lang.toUpperCase()}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  sound.playChirp();
                                  orionVoice.speak(message.text, { lang: message.lang });
                                }}
                                className="text-zinc-400 hover:text-white flex items-center gap-1"
                                title="Replay voice in this language"
                              >
                                🔊 Replay
                              </button>
                            </div>
                          )}
                          {renderText(message.text)}
                          {message.originalText && message.originalText !== message.text && (
                            <div className="mt-2 pt-1 border-t border-[#341d4c]/60 text-[11px] text-zinc-400 font-mono italic">
                              Source (EN): "{message.originalText}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Mouse Command Bar for Avatar */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-[#231433] bg-[#07050e] px-4 py-2">
              <span className="text-[10.5px] font-mono tracking-widest text-muted-foreground uppercase mr-1">
                MOUSE COMMANDS:
              </span>
              {[
                { label: "✋ Wave", g: "wave" as const },
                { label: "⚡ Teleport", g: "teleport" as const },
                { label: "👁️ Stare", g: "stare" as const },
                { label: "👉 Point", g: "point" as const },
                { label: "🫡 Salute", g: "salute" as const },
                { label: "🤔 Think", g: "thinking" as const },
              ].map(({ label, g }) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setCurrentGesture(g);
                    if (g === "wave") sound.playGesture();
                    if (g === "teleport") {
                      sound.playTeleport();
                      window.dispatchEvent(new CustomEvent("orion:teleport", { detail: { target: "hero" } }));
                    }
                    if (g === "stare") sound.playEnderStare();
                    if (g === "salute" || g === "point") sound.playChirp();
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all ${
                    currentGesture === g
                      ? "bg-fuchsia-600 text-white font-semibold shadow-[0_0_10px_rgba(217,70,239,0.5)]"
                      : "text-zinc-300 hover:bg-[#1a102c] hover:text-fuchsia-300 border border-[#2b173e]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="border-t border-[#2b1c3d] p-4 sm:p-5 bg-[#090614]"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-[#3b1d54] bg-[#0c0818] px-3 sm:px-4 py-2 shadow-inner focus-within:border-fuchsia-500/80 transition-colors">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={
                    selectedLang === "auto"
                      ? "Ask ORION anything in any language (English, Español, हिन्दी, 日本語)..."
                      : `Ask ORION in ${translator.getActiveLanguageInfo().nativeName}...`
                  }
                  aria-label="Message ORION"
                  className="w-full bg-transparent py-2 text-[14.5px] text-white outline-none placeholder:text-[#6a5482]"
                />
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`flex items-center gap-1 shrink-0 rounded-xl px-3 py-2 text-[11px] font-mono font-bold transition-all ${
                    isListening
                      ? "bg-red-600 text-white animate-pulse shadow-[0_0_15px_#ef4444]"
                      : "bg-fuchsia-950/60 text-fuchsia-200 border border-fuchsia-700/50 hover:bg-fuchsia-900 hover:text-white"
                  }`}
                  title={`Voice Input in ${translator.getActiveLanguageInfo().nativeName}`}
                >
                  <span>🎤</span>
                  <span className="text-[9px] uppercase hidden sm:inline">{selectedLang}</span>
                </button>
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="btn-primary shrink-0 rounded-xl px-4 sm:px-5 py-2.5 text-[12px] tracking-[0.14em] uppercase disabled:opacity-40"
                >
                  {busy ? "…" : "Transmit"}
                </button>
              </div>
              <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] text-[#86709f]">
                <span>Speech and text stay in step. Double-click the page to call him over.</span>
                <span className="font-mono text-[10.5px] text-emerald-400">STATUS: LIVE</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
