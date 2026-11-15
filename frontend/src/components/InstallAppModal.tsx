import React, { useEffect, useState } from "react";
import { Language } from "../i18n/translations";
import {
  X,
  Download,
  Smartphone,
  Monitor,
  QrCode,
  Copy,
  Check,
  Globe,
  CheckCircle2,
  Terminal,
  Share2,
  ShieldCheck
} from "lucide-react";

interface AccessInfo {
  current_origin: string;
  public_url: string | null;
  lan_urls: string[];
  recommended_share_url: string;
  pwa_manifest_ready: boolean;
  production_bundle_built: boolean;
  windows_exe_ready?: boolean;
  android_project_ready?: boolean;
  android_package_id?: string;
  tunnel_command_hint: string;
}

interface InstallAppModalProps {
  lang: Language;
  canNativeInstall: boolean;
  isInstalled: boolean;
  onTriggerNativeInstall: () => Promise<void>;
  onOpenGuideModal?: () => void;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  lang,
  canNativeInstall,
  isInstalled,
  onTriggerNativeInstall,
  onOpenGuideModal,
  onClose
}) => {
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/v1/meta/access-info")
      .then(r => (r.ok ? r.json() : null))
      .then((d: AccessInfo | null) => {
        if (d) {
          setAccessInfo(d);
          setSelectedUrl(d.recommended_share_url || d.current_origin || window.location.origin);
        }
      })
      .catch(() => {
        setSelectedUrl(window.location.origin);
      });
  }, []);

  const urlChoices: Array<{ label: string; url: string }> = [];
  if (accessInfo) {
    if (accessInfo.public_url) {
      urlChoices.push({ label: "Public HTTPS URL", url: accessInfo.public_url });
    }
    accessInfo.lan_urls.forEach((u, idx) => {
      urlChoices.push({ label: `Wi-Fi / LAN #${idx + 1}`, url: u });
    });
    if (
      accessInfo.current_origin &&
      !urlChoices.some(c => c.url === accessInfo.current_origin)
    ) {
      urlChoices.push({ label: "This Device", url: accessInfo.current_origin });
    }
  } else {
    urlChoices.push({ label: "Current App URL", url: window.location.origin });
  }

  const activeTarget = selectedUrl || window.location.origin;
  const qrSrc = selectedUrl
    ? `/api/v1/meta/access-qr?target=${encodeURIComponent(selectedUrl)}`
    : null;
  const winLauncherHref = `/api/v1/meta/download/windows-launcher?target=${encodeURIComponent(activeTarget)}`;
  const winExeHref = `/api/v1/meta/download/windows-exe?target=${encodeURIComponent(activeTarget)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeTarget);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard restricted
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Modal Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700/80 border border-emerald-400/50 flex items-center justify-center">
              <Download className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg leading-tight">
                {lang === "mr"
                  ? "Kshetra अ‍ॅप डाउनलोड व शेअर करा"
                  : lang === "hi"
                  ? "Kshetra ऐप डाउनलोड और शेयर करें"
                  : "Install, Download & Share Kshetra"}
              </h2>
              <p className="text-[11px] text-emerald-200">
                Android / iOS Home Screen • Windows Desktop App • Wi-Fi &amp; Public HTTPS Access
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

        <div className="p-5 overflow-y-auto space-y-5 text-sm text-stone-800">
          {/* 1. Native PWA Install Banner */}
          <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-emerald-950 text-sm sm:text-base flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                  <span>
                    {lang === "mr"
                      ? "१. मोबाईल आणि संगणकावर थेट अ‍ॅप इंस्टॉल (PWA)"
                      : lang === "hi"
                        ? "1. मोबाइल और कंप्यूटर पर सीधा ऐप इंस्टॉल (PWA)"
                        : "1. Direct App Installation (Android, iOS & Desktop PWA)"}
                  </span>
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  {lang === "mr"
                    ? "ऑफलाईन शेती डेटा व थेट आयकॉनसह ब्राउझर न उघडता स्वतंत्र अ‍ॅपसारखा वापर."
                    : lang === "hi"
                      ? "ऑफलाइन कृषि डेटा और होम-स्क्रीन आइकन के साथ ब्राउज़र के बिना सीधा ऐप अनुभव।"
                      : "Runs in standalone full-screen window mode with offline shell caching and quick shortcuts."}
                </p>
              </div>
              {accessInfo?.pwa_manifest_ready && (
                <span className="shrink-0 text-[10px] font-extrabold bg-emerald-700 text-white px-2 py-0.5 rounded-full">
                  PWA Ready ✓
                </span>
              )}
            </div>

            {isInstalled ? (
              <div className="bg-white border border-emerald-300 rounded-xl p-3 flex items-center space-x-2 text-emerald-900 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  {lang === "mr"
                    ? "Kshetra आधीपासून तुमच्या डिव्हाइसवर अ‍ॅप म्हणून इंस्टॉल आहे."
                    : lang === "hi"
                      ? "Kshetra पहले से आपके डिवाइस पर ऐप के रूप में इंस्टॉल है।"
                      : "Kshetra is currently running as an installed standalone application."}
                </span>
              </div>
            ) : canNativeInstall ? (
              <button
                onClick={onTriggerNativeInstall}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-black text-sm shadow-md flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                <span>
                  {lang === "mr"
                    ? "आताच अ‍ॅप इंस्टॉल करा (One-Click Install)"
                    : lang === "hi"
                      ? "अभी ऐप इंस्टॉल करें (One-Click Install)"
                      : "Install Kshetra App Now"}
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-white rounded-xl p-3 border border-emerald-200/80 space-y-1">
                  <strong className="text-emerald-900 block">Android Chrome / Edge</strong>
                  <p className="text-stone-600">
                    Open menu (<span className="font-mono font-bold">⋮</span>) -&gt; tap{" "}
                    <strong>&quot;Install app&quot;</strong> /{" "}
                    <strong>&quot;Add to Home screen&quot;</strong>.
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-emerald-200/80 space-y-1">
                  <strong className="text-emerald-900 block">iPhone / iPad Safari</strong>
                  <p className="text-stone-600">
                    Tap <strong>Share (↑)</strong> -&gt; select{" "}
                    <strong>&quot;Add to Home Screen&quot;</strong>.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 2. Phone Reachability & Scannable QR Code */}
          <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
            <h3 className="font-black text-stone-900 text-sm sm:text-base flex items-center space-x-2">
              <QrCode className="w-4 h-4 text-sky-700" />
              <span>
                {lang === "mr"
                  ? "२. दुसऱ्या मोबाईल / शेतकऱ्यापर्यंत पोहोचवा (QR व Wi-Fi लिंक)"
                  : "2. Open & Install on Phones Nearby (QR Code + LAN Link)"}
              </span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs shrink-0">
                {qrSrc ? (
                  <img
                    src={qrSrc}
                    alt="Kshetra Access QR Code"
                    className="w-36 h-36 object-contain"
                  />
                ) : (
                  <div className="w-36 h-36 rounded-xl bg-stone-100 animate-pulse flex items-center justify-center text-[11px] font-bold text-stone-400">
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-2.5">
                {urlChoices.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {urlChoices.map(choice => (
                      <button
                        key={choice.url}
                        onClick={() => setSelectedUrl(choice.url)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border transition-colors ${
                          activeTarget === choice.url
                            ? "bg-sky-800 text-white border-sky-800"
                            : "bg-white text-stone-700 border-stone-300 hover:bg-sky-50"
                        }`}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={activeTarget}
                    aria-label="Share URL"
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-stone-300 font-mono text-xs font-bold text-stone-900"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold flex items-center space-x-1 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                <p className="text-[11px] text-stone-600 leading-relaxed">
                  <Share2 className="w-3 h-3 inline mr-1 text-sky-700" />
                  {activeTarget.includes("127.0.0.1") || activeTarget.includes("localhost")
                    ? "Connect phones using the Wi-Fi LAN IP shown above after launching share_app.bat (or python start.py --share --prod)."
                    : "Scan this QR code from any phone camera on the same Wi-Fi hotspot (or anywhere via Public HTTPS) to open and install Kshetra."}
                </p>
              </div>
            </div>
          </section>

          {/* 3. Windows Native EXE, Android APK Kit & Public Internet Tunnel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <section className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2.5">
              <h4 className="font-black text-stone-900 text-xs sm:text-sm flex items-center space-x-1.5">
                <Monitor className="w-4 h-4 text-emerald-700" />
                <span>
                  {lang === "mr"
                    ? "Windows आणि Android अ‍ॅप"
                    : lang === "hi"
                      ? "Windows और Android ऐप"
                      : "Windows EXE & Android APK"}
                </span>
              </h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                {lang === "mr"
                  ? "Windows साठी थेट Kshetra-Desktop.exe डाउनलोड करा — हा अ‍ॅप स्वतः तुमचा निवडलेला सर्व्हर URL किंवा Downloads मधील फोल्डर शोधून सुरू होतो."
                  : lang === "hi"
                    ? "Windows के लिए Kshetra-Desktop.exe डाउनलोड करें — यह अपने आप आपका चुना हुआ सर्वर URL या Downloads में मौजूद प्रोजेक्ट फ़ोल्डर ढूंढकर चालू होता है।"
                    : "Smart Windows launcher embeds your selected URL automatically and auto-detects extracted Kshetra folders on your PC."}
              </p>
              <div className="space-y-1.5">
                {accessInfo?.windows_exe_ready !== false && (
                  <a
                    href={winExeHref}
                    download="Kshetra-Desktop.exe"
                    className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Download Kshetra-Desktop.exe</span>
                  </a>
                )}
                <a
                  href={winLauncherHref}
                  download="Kshetra-App.bat"
                  className="w-full py-1.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-bold flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>Download Kshetra-App.bat (URL Shortcut)</span>
                </a>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-2 text-[10px] text-amber-950 leading-relaxed">
                <strong>Android APK ({accessInfo?.android_package_id || "in.kshetra.agri"}):</strong>{" "}
                {lang === "mr"
                  ? "Chrome मधून तात्काळ WebAPK इंस्टॉल करा किंवा Android Studio असलेल्या PC वर mobile\\build_apk.ps1 चालवून .apk तयार करा."
                  : lang === "hi"
                    ? "Chrome से तुरंत WebAPK इंस्टॉल करें या Android Studio वाले PC पर mobile\\build_apk.ps1 चलाकर .apk बनाएँ।"
                    : "Instant install via Android Chrome WebAPK right now, or compile standalone .apk via mobile\\build_apk.ps1 (requires Android Studio SDK)."}
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
              <h4 className="font-black text-stone-900 text-xs sm:text-sm flex items-center space-x-1.5">
                <Globe className="w-4 h-4 text-amber-600" />
                <span>Public Internet URL (Anywhere)</span>
              </h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Share globally over HTTPS (unlocks instant Android WebAPK install anywhere):
              </p>
              <div className="bg-stone-900 text-emerald-300 font-mono text-[10px] p-2.5 rounded-xl space-y-1">
                <div className="flex items-center space-x-1 text-stone-400">
                  <Terminal className="w-3 h-3" />
                  <span>1. Start server: share_app.bat</span>
                </div>
                <div className="select-all">
                  2. {accessInfo?.tunnel_command_hint || "cloudflared tunnel --url http://127.0.0.1:5000"}
                </div>
              </div>
              {onOpenGuideModal && (
                <button
                  onClick={onOpenGuideModal}
                  className="w-full py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-extrabold flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    {lang === "mr"
                      ? "सुरक्षा, डेटा, AI व फ्लोचार्ट Q&A पहा"
                      : lang === "hi"
                        ? "सुरक्षा, डेटा, AI व फ़्लोचार्ट Q&A देखें"
                        : "View Security, Storage, AI & Flowchart Q&A"}
                  </span>
                </button>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
