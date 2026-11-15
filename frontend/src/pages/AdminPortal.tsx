import React, { useState, useEffect, useCallback } from "react";
import { Language, translations } from "../i18n/translations";
import {
  UserPlus,
  Printer,
  Key,
  Unlock,
  Lock,
  Trash2,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Download,
  Megaphone,
  FileCheck2
} from "lucide-react";

interface AdminPortalProps {
  token: string;
  lang: Language;
  onBack: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ token, lang, onBack }) => {
  const [overview, setOverview] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showAnnModal, setShowAnnModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [issuedPasswords, setIssuedPasswords] = useState<Record<string, string>>({});

  // Create farmer form state
  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
  const [taluka, setTaluka] = useState("Rahuri");
  const [district, setDistrict] = useState("Ahilya Nagar");
  const [mobile, setMobile] = useState("");

  // Announcement form state
  const [annDistrict, setAnnDistrict] = useState("Ahilya Nagar");
  const [annTaluka, setAnnTaluka] = useState("");
  const [annSeverity, setAnnSeverity] = useState("info");
  const [annTitleMr, setAnnTitleMr] = useState("");
  const [annBodyMr, setAnnBodyMr] = useState("");

  const t = translations[lang];

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch("/api/v1/admin/overview", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        setOverview(data);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleCreateFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch("/api/v1/admin/farmers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          village,
          taluka,
          district,
          mobile,
          preferred_language: lang
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || data?.message || "Failed to add farmer");
      }

      const fid = data.farmer?.farmer_id;
      const tempPwd = data.temporary_password;
      if (fid && tempPwd) {
        setIssuedPasswords(prev => ({ ...prev, [fid]: tempPwd }));
      }
      setActionMsg(
        `शेतकरी खाते तयार झाले! ID: ${fid} | एकवेळ पासवर्ड (OTP): ${tempPwd} — ओळखपत्र छापून घ्या.`
      );
      setShowAddModal(false);
      setName("");
      setVillage("");
      setMobile("");
      loadOverview();
    } catch (err: any) {
      setActionMsg(`त्रुटी: ${err.message}`);
    }
  };

  const handleResetPassword = async (farmerId: string) => {
    try {
      const resp = await fetch(`/api/v1/admin/farmers/${farmerId}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        const pwd = data.temporary_password;
        setIssuedPasswords(prev => ({ ...prev, [farmerId]: pwd }));
        setActionMsg(`शेतकरी ${farmerId} साठी नवीन तात्पुरता पासवर्ड: ${pwd}`);
        loadOverview();
      }
    } catch (err: any) {
      setActionMsg(`त्रुटी: ${err.message}`);
    }
  };

  const handleToggleLock = async (farmerId: string, currentlyLocked: boolean) => {
    const endpoint = currentlyLocked ? "unlock" : "lock";
    try {
      const resp = await fetch(`/api/v1/admin/farmers/${farmerId}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setActionMsg(
          currentlyLocked
            ? `शेतकरी ${farmerId} खाते अनलॉक केले.`
            : `शेतकरी ${farmerId} खाते लॉक केले.`
        );
        loadOverview();
      }
    } catch {
      // Ignore
    }
  };

  const handleDeleteFarmer = async (farmerId: string) => {
    if (!window.confirm(`शेतकरी ${farmerId} खाते आणि शेत नोंदी कायमच्या हटवायच्या आहेत का?`)) {
      return;
    }
    try {
      const resp = await fetch(`/api/v1/admin/farmers/${farmerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setActionMsg(`शेतकरी ${farmerId} खाते हटवले (२० शेतकरी मर्यादेत १ जागा मोकळी झाली).`);
        loadOverview();
      }
    } catch {
      // Ignore
    }
  };

  const handleVerifyParcel = async (parcelId: number, nextVerified: boolean) => {
    try {
      const resp = await fetch(`/api/v1/admin/parcels/${parcelId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ land_verified: nextVerified })
      });
      if (resp.ok) {
        setActionMsg(
          nextVerified
            ? `शेत तुकडा #${parcelId} ७/१२ प्रमाणित (Verified) केला.`
            : `शेत तुकडा #${parcelId} प्रमाणित स्थिती काढली.`
        );
        loadOverview();
      }
    } catch {
      // Ignore
    }
  };

  const handleDownloadSingleCard = async (farmerId: string) => {
    const otp = issuedPasswords[farmerId] || "";
    const qs = otp ? `?otp=${encodeURIComponent(otp)}` : "";
    const resp = await fetch(`/api/v1/reports/credential-card/${farmerId}${qs}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Kshetra_Card_${farmerId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadBatchCards = async () => {
    const resp = await fetch("/api/v1/reports/credential-cards/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ passwords: issuedPasswords })
    });
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Kshetra_Batch_Credential_Cards.pdf";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadCsv = async () => {
    const resp = await fetch("/api/v1/admin/export/farmers.csv", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kshetra_farmers_report.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch("/api/v1/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          district: annDistrict,
          taluka: annTaluka || null,
          severity: annSeverity,
          title_mr: annTitleMr,
          title_hi: annTitleMr,
          title_en: annTitleMr,
          body_mr: annBodyMr,
          body_hi: annBodyMr,
          body_en: annBodyMr
        })
      });
      if (resp.ok) {
        setShowAnnModal(false);
        setAnnTitleMr("");
        setAnnBodyMr("");
        setActionMsg("तालुका कृषी सूचना सर्व संबंधित शेतकऱ्यांना प्रकाशित केली!");
      }
    } catch {
      // Ignore
    }
  };

  const capacity = overview?.capacity || { active_farmers: 0, max_farmers: 20, remaining_slots: 20 };
  const farmersList = overview?.farmers || [];
  const sourceHealth = overview?.source_health || [];
  const auditLogs = overview?.audit_logs || [];
  const feedbackList = overview?.feedback || [];

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans">
      {/* Admin Top Header */}
      <header className="bg-amber-950 text-white px-4 py-3 shadow-md border-b-2 border-amber-800">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-amber-900 rounded-lg text-amber-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl text-amber-100 flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>{t.admin_title}</span>
              </h1>
              <p className="text-xs text-amber-300 font-mono">
                क्षमता (Capacity): {capacity.active_farmers} / {capacity.max_farmers} Farmers ({capacity.remaining_slots} slots free)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              disabled={capacity.active_farmers >= capacity.max_farmers}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.add_farmer}</span>
            </button>

            <button
              onClick={() => setShowAnnModal(true)}
              className="bg-sky-700 hover:bg-sky-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow"
            >
              <Megaphone className="w-4 h-4" />
              <span>सूचना प्रसारित करा</span>
            </button>

            <button
              onClick={handleDownloadBatchCards}
              className="bg-amber-800 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{t.batch_print}</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="bg-stone-800 hover:bg-stone-700 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1 space-y-6">
        {actionMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-400 rounded-2xl flex items-center justify-between text-emerald-950 text-xs sm:text-sm font-bold shadow-xs">
            <span className="font-mono">{actionMsg}</span>
            <button onClick={() => setActionMsg(null)} className="text-emerald-700 ml-3">
              ✕
            </button>
          </div>
        )}

        {/* 1. Capacity Meter Bar (N of 20) */}
        <section className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-black text-sm text-stone-900">
              नोंदणीकृत शेतकरी कोटा (Hard Cap Enforcement: {capacity.active_farmers} of {capacity.max_farmers})
            </span>
            <span className="text-xs font-mono font-bold text-emerald-800">
              {Math.round((capacity.active_farmers / capacity.max_farmers) * 100)}% Used
            </span>
          </div>
          <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-700 transition-all"
              style={{
                width: `${Math.min(100, (capacity.active_farmers / capacity.max_farmers) * 100)}%`
              }}
            />
          </div>
        </section>

        {/* 2.Registered Farmers & Land Verification Table */}
        <section className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-stone-900">
                नोंदणीकृत शेतकरी व ७/१२ शेत पडताळणी (Farmers &amp; Parcel Verification)
              </h2>
              <p className="text-xs text-stone-500">
                शेतकरी आयडी, पासवर्ड रिसेट, अनलॉक, A6 ओळखपत्र प्रिंट आणि ७/१२ पडताळणी
              </p>
            </div>
            <button
              onClick={loadOverview}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {farmersList.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-sm font-semibold">
              अजून कोणताही शेतकरी नोंदणीकृत नाही. वरच्या &apos;{t.add_farmer}&apos; बटणावर क्लिक करून पहिला शेतकरी जोडा.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase text-[11px]">
                    <th className="pb-3 px-2">आयडी (ID)</th>
                    <th className="pb-3 px-2">नाव (Name)</th>
                    <th className="pb-3 px-2">गाव / तालुका / जिल्हा</th>
                    <th className="pb-3 px-2">शेत तुकडे (7/12 Verify)</th>
                    <th className="pb-3 px-2 text-right">कृती (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {farmersList.map((f: any) => (
                    <tr key={f.farmer_id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-2 font-mono font-bold text-emerald-900">
                        {f.farmer_id}
                      </td>
                      <td className="py-3 px-2 font-bold text-stone-800">
                        {f.name}
                        {f.is_locked && (
                          <span className="ml-2 text-rose-600 font-semibold text-xs">
                            [Locked]
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-stone-600">
                        {f.village}, {f.taluka}, {f.district}
                      </td>
                      <td className="py-3 px-2">
                        {(f.parcels || []).length === 0 ? (
                          <span className="text-xs text-stone-400">0 parcels</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {f.parcels.map((p: any) => (
                              <button
                                key={p.id}
                                onClick={() => handleVerifyParcel(p.id, !p.land_verified)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center space-x-1 border ${
                                  p.land_verified
                                    ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                                    : "bg-amber-50 border-amber-300 text-amber-900"
                                }`}
                                title="Click to toggle 7/12 Land Verification"
                              >
                                <FileCheck2 className="w-3 h-3" />
                                <span>
                                  {p.name} ({p.area_acres}ac){" "}
                                  {p.land_verified ? "✓ Verified" : "Verify 7/12"}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleLock(f.farmer_id, Boolean(f.is_locked))}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg"
                          title={f.is_locked ? "अनलॉक करा" : "लॉक करा"}
                        >
                          {f.is_locked ? (
                            <Unlock className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleResetPassword(f.farmer_id)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg"
                          title="पासवर्ड रिसेट"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadSingleCard(f.farmer_id)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg"
                          title="ओळखपत्र डाउनलोड करा (A6 PDF)"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFarmer(f.farmer_id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg"
                          title="खाते हटवा"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3. Data Source Health & Farmer Feedback Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200">
            <h2 className="text-base font-extrabold text-stone-900 mb-3">
              {t.data_health} (Upstream Telemetry)
            </h2>
            {sourceHealth.length === 0 ? (
              <p className="text-xs text-stone-500">
                No upstream failures recorded. Sources are polled on demand and by background worker.
              </p>
            ) : (
              <div className="space-y-2">
                {sourceHealth.map((src: any) => {
                  const isOk = src.status === "healthy";
                  return (
                    <div
                      key={src.source_name}
                      className="p-3 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-extrabold text-stone-900 block">
                          {src.source_name}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          Latency: {src.latency_ms ?? "--"} ms • Updated:{" "}
                          {src.last_success_at ? src.last_success_at.slice(0, 16) : "Never"}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold flex items-center space-x-1 ${
                          isOk
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isOk ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        <span className="uppercase text-[10px]">{src.status}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200">
            <h2 className="text-base font-extrabold text-stone-900 mb-3">
              शेतकरी अभिप्राय व तक्रारी (Farmer Feedback)
            </h2>
            {feedbackList.length === 0 ? (
              <p className="text-xs text-stone-500">अजून कोणतीही तक्रार किंवा अभिप्राय नाही.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {feedbackList.slice(0, 12).map((fb: any) => (
                  <div
                    key={fb.id}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-stone-800">
                      <span>
                        {fb.farmer_id} • {fb.target_type}
                      </span>
                      <span>
                        {fb.rating === 1 ? "👍 Helpful" : fb.rating === -1 ? "👎 Not Helpful" : ""}
                      </span>
                    </div>
                    {fb.comment && <p className="text-stone-600 mt-1">{fb.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 4. Security Audit Trail */}
        <section className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200">
          <h2 className="text-base font-extrabold text-stone-900 mb-3">
            सुरक्षा ऑडिट लॉग (Immutable Security Audit Log)
          </h2>
          <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 text-xs">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-emerald-900">{log.actor_id}</span>{" "}
                  <span className="font-semibold text-stone-800">{log.action}</span>{" "}
                  {log.target_id && (
                    <span className="font-mono text-stone-600">→ {log.target_id}</span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-stone-400">
                  {log.created_at ? log.created_at.slice(0, 19).replace("T", " ") : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Add Farmer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-black text-stone-900 mb-4">
              नवीन शेतकरी नोंदणी ({capacity.active_farmers + 1} of {capacity.max_farmers})
            </h2>
            <form onSubmit={handleCreateFarmer} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-stone-700 mb-1">शेतकऱ्याचे पूर्ण नाव:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">जिल्हा:</label>
                  <select
                    value={district}
                    onChange={e => {
                      setDistrict(e.target.value);
                      setTaluka(e.target.value === "Ahilya Nagar" ? "Rahuri" : "Niphad");
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  >
                    <option value="Ahilya Nagar">Ahilya Nagar</option>
                    <option value="Nashik">Nashik</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">तालुका:</label>
                  <input
                    type="text"
                    required
                    value={taluka}
                    onChange={e => setTaluka(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">गाव:</label>
                <input
                  type="text"
                  required
                  value={village}
                  onChange={e => setVillage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  मोबाईल क्र. (पर्यायी — AES एनक्रिप्टेड):
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>

              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 font-bold text-white shadow"
                >
                  नोंदणी करा
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Announcement Modal */}
      {showAnnModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-black text-stone-900 mb-4">
              तालुका कृषी सूचना प्रसारित करा (Publish Advisory)
            </h2>
            <form onSubmit={handlePublishAnnouncement} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">जिल्हा:</label>
                  <select
                    value={annDistrict}
                    onChange={e => setAnnDistrict(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  >
                    <option value="Ahilya Nagar">Ahilya Nagar</option>
                    <option value="Nashik">Nashik</option>
                    <option value="All">दोन्ही जिल्हे (All)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    तालुका (रिकामे = सर्व):
                  </label>
                  <input
                    type="text"
                    value={annTaluka}
                    onChange={e => setAnnTaluka(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">गंभीरता (Severity):</label>
                <select
                  value={annSeverity}
                  onChange={e => setAnnSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                >
                  <option value="info">माहिती (Info)</option>
                  <option value="warning">सतर्कता (Warning)</option>
                  <option value="urgent">तातडीचा इशारा (Urgent)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">शीर्षक (Title):</label>
                <input
                  type="text"
                  required
                  value={annTitleMr}
                  onChange={e => setAnnTitleMr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">सविस्तर सूचना:</label>
                <textarea
                  required
                  rows={3}
                  value={annBodyMr}
                  onChange={e => setAnnBodyMr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>

              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 font-bold text-white shadow"
                >
                  प्रसारित करा
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
