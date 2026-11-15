import React, { useState } from "react";
import { Language } from "../i18n/translations";
import {
  X,
  ShieldCheck,
  Database,
  Cloud,
  Bot,
  GitBranch,
  HelpCircle,
  Lock,
  ArrowDown,
  Smartphone,
  Cpu,
  CheckCircle2
} from "lucide-react";

interface SystemGuideModalProps {
  lang: Language;
  onClose: () => void;
}

type GuideTab = "flowchart" | "security" | "apis_ai" | "faq";

export const SystemGuideModal: React.FC<SystemGuideModalProps> = ({ lang, onClose }) => {
  const [tab, setTab] = useState<GuideTab>("flowchart");

  const titles: Record<Language, string> = {
    mr: "Kshetra प्रणाली रचना, सुरक्षा, डेटा व AI माहिती",
    hi: "Kshetra सिस्टम संरचना, सुरक्षा, डेटा और AI गाइड",
    en: "Kshetra Architecture, Security, Data & AI Guide"
  };

  const tabLabels: Record<GuideTab, Record<Language, string>> = {
    flowchart: { mr: "फ्लोचार्ट (Flowchart)", hi: "फ्लोचार्ट (Flowchart)", en: "Workflow Flowchart" },
    security: { mr: "सुरक्षा आणि डेटा स्टोरेज", hi: "सुरक्षा और डेटा स्टोरेज", en: "Security & Data Storage" },
    apis_ai: { mr: "APIs आणि AI ग्राउंडिंग", hi: "APIs और AI ग्राउंडिंग", en: "APIs & AI Model" },
    faq: { mr: "सोपे प्रश्न-उत्तरे (Q&A)", hi: "सरल प्रश्न-उत्तर (Q&A)", en: "Simple Q&A" }
  };

  const faqs = [
    {
      q: {
        mr: "१. शेतात इंटरनेट बंद पडल्यास Kshetra बंद पडते का?",
        hi: "1. खेत में इंटरनेट बंद होने पर क्या Kshetra काम करना बंद कर देता है?",
        en: "1. Does Kshetra crash if farm internet drops?"
      },
      a: {
        mr: "नाही. PWA मुळे अ‍ॅपची स्क्रीन कॅश होते, SQLite मधील मागील अस्सल हवामान नोंदी 'Old data from <date>' म्हणून दिसतात आणि आमचे अंतर्गत kshetra-agronomy-engine व अनुवादक ऑफलाईनसुद्धा सल्ला देतात.",
        hi: "नहीं। PWA के कारण स्क्रीन कैश रहती है, SQLite में सहेजा पिछला वास्तविक मौसम 'Old data from <date>' के रूप में दिखता है, और हमारा आंतरिक kshetra-agronomy-engine व अनुवादक बिना इंटरनेट की भी सलाह देता है।",
        en: "No. PWA service worker caches the shell UI, SQLite keeps the latest WeatherSnapshot tagged 'Old data from <date>' (never fabricated zero), and our offline kshetra-agronomy-engine + translator keep answering safely."
      }
    },
    {
      q: {
        mr: "२. AI चुकीचे कीटकनाशक किंवा चुकीचे पाणी प्रमाण सुचवू शकते का?",
        hi: "2. क्या AI गलत कीटनाशक मात्रा या पानी का अनुमान लगा सकता है?",
        en: "2. Can the AI guess a wrong chemical dose or water figure?"
      },
      a: {
        mr: "अंदाज मारला जात नाही. प्रत्येक प्रश्नासोबत शेतकऱ्याचा वास्तविक सर्व्हे प्लॉट, माती, थेट Open-Meteo डेटा व MPKV राहुरी मोजमाप जोडले जाते; रसायन/खर्चाच्या प्रश्नांवर KVK सत्यापन सूचना येते व नसलेला डेटा सरळ 'No data' दाखवला जातो.",
        hi: "बिना आधार अनुमान नहीं लगाया जाता। हर प्रश्न के साथ किसान का वास्तविक प्लॉट, मिट्टी, लाइव Open-Meteo डेटा व MPKV राहुरी नियम जुड़ते हैं; रसायन/वित्त प्रश्नों पर KVK सत्यापन चेतावनी आती है और अनुपलब्ध डेटा 'No data' दिखता है।",
        en: "No blind guessing: every prompt injects verified farm geometry, soil chemistry, live weather, and MPKV-calibrated scores. Missing feeds strictly return 'No data', and pesticide/credit queries append mandatory KVK verification notices."
      }
    },
    {
      q: {
        mr: "३. एक शेतकरी दुसऱ्या शेतकऱ्याचे शेत, फोन किंवा चॅट पाहू शकतो का?",
        hi: "3. क्या एक किसान दूसरे किसान की जमीन, फ़ोन या चैट देख सकता है?",
        en: "3. Can Farmer A inspect Farmer B's plot, mobile, or chats?"
      },
      a: {
        mr: "नाही. प्रत्येक API वर सर्व्हर-स्तरीय मालकी तपासणी (FORBIDDEN_OWNERSHIP 403) लागू आहे, मोबाईल व सर्व्हे/गट क्रमांक enc:v1: ने एनक्रिप्टेड आहेत आणि टोकन दर ३० मिनिटांनी नूतनीकरण होतात.",
        hi: "नहीं। हर API पर सर्वर-स्तरीय स्वामित्व जाँच (FORBIDDEN_OWNERSHIP 403) है, मोबाइल और सर्वे नंबर enc:v1: से एन्क्रिप्टेड हैं, और JWT टोकन हर 30 मिनट में रोटेट होते हैं।",
        en: "Blocked completely. Every resource checks server ownership (HTTP 403 FORBIDDEN_OWNERSHIP), mobile and survey/Gat fields are encrypted at rest (enc:v1:), and 30-min JWT + family-tracked rotating refresh tokens prevent replay."
      }
    },
    {
      q: {
        mr: "४. ४० शेतकऱ्यांची मर्यादा व 'एक जमीन = एक शेतकरी' नियम का ठेवला आहे?",
        hi: "4. 40 किसानों की सीमा और 'एक जमीन = एक किसान' नियम क्यों रखा गया है?",
        en: "4. Why cap at 40 farmers and enforce 1 land = 1 farmer?"
      },
      a: {
        mr: "एका कृषी केंद्र क्लस्टरमध्ये अचूक देखरेख ठेवण्यासाठी ४० शेतकऱ्यांची मर्यादा आहे आणि दोन व्यक्तींनी एकाच गटावर अतिक्रमण करणारा नकाशा काढल्यास ४०९ PARCEL_OVERLAP ने तात्काळ रोखले जाते.",
        hi: "एक कृषि केंद्र क्लस्टर में सटीक निगरानी के लिए 40 किसानों की सीमा है, और यदि दो किसान एक ही जमीन की सीमा बनाते हैं तो एटॉमिक लेनदेन में 409 PARCEL_OVERLAP द्वारा तुरंत रोका जाता है।",
        en: "It maintains an accountable village Krishi Kendra cohort while atomic database polygon overlap checks block duplicate/overlapping land claims immediately (HTTP 409 PARCEL_OVERLAP)."
      }
    },
    {
      q: {
        mr: "५. हे फक्त बाह्य ChatGPT सारखे रॅपर आहे का?",
        hi: "5. क्या यह केवल किसी बाहरी चैटबॉट का रैपर है?",
        en: "5. Is this just a thin wrapper around a public chatbot?"
      },
      a: {
        mr: "नाही. कोणत्याही बाह्य AI की (API Key) शिवायसुद्धा Kshetra थेट उपग्रह प्लॉट मॅपिंग, ४८ तासांची फवारणी विंडो, FAO-56 पाणी गणना, १०० पैकी ५-घटक पीक गुणांकन, PDF कार्ड आणि त्रैभाषिक आवाज सल्ला स्वतः चालवते.",
        hi: "नहीं। बिना किसी बाहरी AI कुंजी के भी Kshetra उपग्रह प्लॉट मैपिंग, 48-घंटे छिड़काव विंडो, FAO-56 सिंचाई गणना, 100 में से 5-कारक फसल स्कोर, PDF कार्ड और त्रिभाषी वॉइस स्वयं चलाता है।",
        en: "No. Even with zero external AI key configured, Kshetra executes satellite polygon geodesy, 48h wind/RH spray safety windows, FAO-56 water volume math, 5-factor 0-100 suitability scoring, signed PDF dossiers, and offline trilingual voice."
      }
    },
    {
      q: {
        mr: "६. Windows .exe व Android फोनवर अ‍ॅप कसे वापरावे?",
        hi: "6. Windows .exe और Android फ़ोन पर ऐप कैसे इंस्टॉल करें?",
        en: "6. How do users install it on Windows and Android?"
      },
      a: {
        mr: "Install & Share मोडलमधून Windows साठी Kshetra-Desktop.exe डाउनलोड करा. Android फोनवर Chrome मधून QR स्कॅन करून तात्काळ WebAPK इंस्टॉल करा किंवा mobile/build_apk.ps1 द्वारे Android Studio वरून .apk तयार करा.",
        hi: "Install & Share से Windows के लिए Kshetra-Desktop.exe डाउनलोड करें। Android पर Chrome से QR स्कैन कर तुरंत WebAPK इंस्टॉल करें या Android Studio वाले PC पर mobile/build_apk.ps1 से .apk बनाएँ।",
        en: "Download Kshetra-Desktop.exe directly from Install & Share for Windows. On Android, install instantly as a Chrome WebAPK via QR scan or compile a standalone .apk using mobile\\build_apk.ps1 where Android Studio SDK is installed."
      }
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col text-stone-900">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-stone-950 via-emerald-950 to-teal-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700/80 border border-emerald-400/50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg leading-tight">{titles[lang]}</h2>
              <p className="text-[11px] text-emerald-200">
                Production Verified • MPKV Rahuri Agronomy • DPDP Act 2023 Compliant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-2 bg-stone-50 border-b border-stone-200 flex flex-wrap gap-1.5">
          {(["flowchart", "security", "apis_ai", "faq"] as GuideTab[]).map(key => {
            const Icon =
              key === "flowchart"
                ? GitBranch
                : key === "security"
                  ? Lock
                  : key === "apis_ai"
                    ? Bot
                    : HelpCircle;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all border ${
                  tab === key
                    ? "bg-emerald-900 text-white border-emerald-900 shadow-xs"
                    : "bg-white text-stone-700 border-stone-300 hover:bg-emerald-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tabLabels[key][lang]}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed">
          {tab === "flowchart" && (
            <div className="space-y-3">
              <p className="text-stone-600 text-xs">
                {lang === "mr"
                  ? "शेतकरी किंवा अधिकारी डिव्हाइसपासून थेट उपग्रह, हवामान API आणि सुरक्षित डेटाबेसपर्यंतची अचूक कार्यप्रणाली:"
                  : lang === "hi"
                    ? "किसान/अधिकारी डिवाइस से लेकर सैटेलाइट, मौसम API और सुरक्षित डेटाबेस तक की पूरी कार्यप्रणाली:"
                    : "End-to-end live data flow from farmer/officer device through security gates, databases, scientific feeds, and grounded AI:"}
              </p>

              <div className="flex flex-col items-center space-y-2">
                <div className="w-full rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Smartphone className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div>
                      <strong className="text-emerald-950 block">1. Client Layer (Web PWA / Android WebAPK &amp; APK / Windows .exe)</strong>
                      <span className="text-[11px] text-stone-600">
                        Marathi, Hindi, English UI + Web Speech Mic/Voice + Offline Service Worker Cache
                      </span>
                    </div>
                  </div>
                </div>

                <ArrowDown className="w-4 h-4 text-emerald-700" />

                <div className="w-full rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Lock className="w-5 h-5 text-amber-700 shrink-0" />
                    <div>
                      <strong className="text-amber-950 block">2. Security &amp; RBAC Gate (/api/v1 + CSP/HSTS)</strong>
                      <span className="text-[11px] text-stone-700">
                        Argon2id + 5-Fail Lockout + 30-min HS256 JWT + Rotating Refresh Family + Object Ownership Check (HTTP 403 IDOR Guard)
                      </span>
                    </div>
                  </div>
                </div>

                <ArrowDown className="w-4 h-4 text-amber-700" />

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border border-stone-300 bg-stone-50 p-3">
                    <div className="flex items-center space-x-1.5 font-black text-stone-900 mb-1">
                      <Database className="w-4 h-4 text-emerald-700" />
                      <span>3A. Local Encrypted DB &amp; Catalogs</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      SQLite WAL (<code>backend/kshetra.db</code>) / PostgreSQL (12 tables) • Sensitive mobile &amp; Gat numbers encrypted (<code>enc:v1:</code>) • MPKV <code>crops.json</code> &amp; district GeoJSONs.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-sky-300 bg-sky-50 p-3">
                    <div className="flex items-center space-x-1.5 font-black text-sky-950 mb-1">
                      <Cloud className="w-4 h-4 text-sky-700" />
                      <span>3B. Allowlisted External APIs</span>
                    </div>
                    <p className="text-[11px] text-sky-900">
                      Open-Meteo (48h/7d weather, ET0, soil moisture) • ISRIC SoilGrids (250m pH, SOC, clay) • NASA POWER/GIBS • Agmarknet mandi (with Circuit Breaker + SSRF allowlist).
                    </p>
                  </div>
                </div>

                <ArrowDown className="w-4 h-4 text-sky-700" />

                <div className="w-full rounded-2xl border-2 border-teal-400 bg-teal-50 p-3">
                  <div className="flex items-center space-x-2 font-black text-teal-950 mb-1">
                    <Cpu className="w-4 h-4 text-teal-700" />
                    <span>4. 5-Factor Agronomy Engine + Grounded Krishi Mitra AI</span>
                  </div>
                  <p className="text-[11px] text-stone-700">
                    Combines exact GeoJSON plot centroid + live climate + rotation history -&gt; computes 0-100 suitability, FAO-56 water volume &amp; spray windows -&gt; grounds Gemini / OpenAI / Ollama or runs offline <code>kshetra-agronomy-engine</code> + trilingual translator.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2">
                <h3 className="font-black text-emerald-950 flex items-center space-x-1.5">
                  <Lock className="w-4 h-4 text-emerald-700" />
                  <span>Security Controls</span>
                </h3>
                <ul className="space-y-1.5 text-xs text-stone-700 list-disc pl-4">
                  <li><strong>Argon2id Passwords</strong> (PBKDF2 600k fallback) + <strong>5-attempt 15-min lockout</strong> + IP rate limiter.</li>
                  <li><strong>30-min HS256 JWT</strong> + 7-day hashed rotating refresh tokens with automatic family revocation on reuse.</li>
                  <li><strong>PII Column Encryption (<code>enc:v1:</code>):</strong> 12B nonce + SHA-256 CTR + 16B HMAC-SHA256 on mobile &amp; survey/Gat numbers.</li>
                  <li><strong>IDOR Protection:</strong> Ownership check on every farmer route returns HTTP 403 <code>FORBIDDEN_OWNERSHIP</code>.</li>
                  <li><strong>SSRF &amp; Upload Defense:</strong> Host allowlist + 2 MB GeoJSON/KML limit blocking XML <code>&lt;!DOCTYPE</code>/<code>&lt;!ENTITY</code> XXE.</li>
                  <li><strong>DPDP Act 2023:</strong> Explicit consent tracking, JSON portability export, self-erasure, immutable audit log.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2">
                <h3 className="font-black text-emerald-950 flex items-center space-x-1.5">
                  <Database className="w-4 h-4 text-amber-700" />
                  <span>Where Data Is Stored</span>
                </h3>
                <ul className="space-y-1.5 text-xs text-stone-700 list-disc pl-4">
                  <li><strong>SQLite WAL DB (<code>backend/kshetra.db</code>)</strong> or <strong>PostgreSQL (<code>DATABASE_URL</code>)</strong> across <strong>12 tables</strong>: <code>farmers</code>, <code>parcels</code>, <code>crop_history</code>, <code>field_observations</code>, <code>weather_snapshots</code>, <code>refresh_tokens</code>, <code>assistant_messages</code>, <code>announcements</code>, <code>feedback_entries</code>, <code>source_health_records</code>, <code>notification_logs</code>, <code>audit_logs</code>.</li>
                  <li><strong>Agronomic Catalogs (<code>data/</code>):</strong> <code>crops.json</code>, <code>risk-rules.json</code>, <code>glossary.json</code>, and district/taluka GeoJSONs.</li>
                  <li><strong>Client Device:</strong> <code>localStorage</code> session + voice preferences and offline PWA <code>sw.js</code> shell cache. Sensitive <code>.db</code> / <code>.env</code> / credentials are gitignored.</li>
                </ul>
              </div>
            </div>
          )}

          {tab === "apis_ai" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-2">
                <h3 className="font-black text-sky-950 flex items-center space-x-1.5">
                  <Cloud className="w-4 h-4 text-sky-700" />
                  <span>External &amp; Browser APIs Connected</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-800">
                  <div className="bg-white rounded-xl p-2.5 border border-sky-200">
                    <strong>Open-Meteo Forecast API</strong>
                    <p className="text-stone-600 mt-0.5">7-day forecast, 48h spray wind/RH, 30-day history, FAO ET0, 0-7cm soil moisture + 1h SQLite cache.</p>
                  </div>
                  <div className="bg-white rounded-xl p-2.5 border border-sky-200">
                    <strong>ISRIC SoilGrids v2.0 &amp; NASA POWER/GIBS</strong>
                    <p className="text-stone-600 mt-0.5">250m soil pH, clay, sand, organic C, nitrogen plus agro-climatology &amp; Esri/OSM satellite tiles.</p>
                  </div>
                  <div className="bg-white rounded-xl p-2.5 border border-sky-200">
                    <strong>Agmarknet (data.gov.in)</strong>
                    <p className="text-stone-600 mt-0.5">Live mandi prices when key configured; displays transparent &quot;No data&quot; without guessing if unconfigured.</p>
                  </div>
                  <div className="bg-white rounded-xl p-2.5 border border-sky-200">
                    <strong>AI Adapter + Web Platform APIs</strong>
                    <p className="text-stone-600 mt-0.5">Gemini 2.5 Flash / GPT-4o-mini / Ollama + offline agronomic fallback, Geolocation, Web Speech API, PWA.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
                <h3 className="font-black text-emerald-950 flex items-center space-x-1.5">
                  <Bot className="w-4 h-4 text-emerald-700" />
                  <span>How the AI Model Works on the Ground (No Unverified Weight Tuning)</span>
                </h3>
                <p className="text-xs text-stone-700">
                  Kshetra uses <strong>Real-Time Coordinate RAG + a Deterministic MPKV-Calibrated Scoring Engine</strong> rather than custom neural weight training:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>Reads mapped polygon centroid, Acres/Gunthas, soil type, irrigation, and sown crop rotation from SQLite.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>Computes transparent 0-100 suitability score (Water 30 + Soil 25 + Temp 20 + Duration 15 + Rotation 10) &amp; FAO-56 water litres.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>Sanitizes prompts (1000-char max, 30 msg/hr, prompt-injection patterns blocked) before grounding LLM or offline engine.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>Cites exact telemetry sources, honors &quot;No data&quot; strictly, and appends mandatory KVK IPM verification warnings.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "faq" && (
            <div className="space-y-2.5">
              {faqs.map((item, idx) => (
                <div key={idx} className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5 space-y-1">
                  <h4 className="font-black text-emerald-950 text-xs sm:text-sm">{item.q[lang]}</h4>
                  <p className="text-xs text-stone-700 leading-relaxed">{item.a[lang]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
