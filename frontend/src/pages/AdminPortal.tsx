import React, { useState, useEffect } from "react";
import { Language, translations } from "../i18n/translations";
import { UserPlus, Printer, Key, Unlock, ShieldAlert, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, Layers } from "lucide-react";

interface AdminPortalProps {
  token: string;
  lang: Language;
  onBack: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ token, lang, onBack }) => {
  const [farmersList, setFarmersList] = useState<any[]>([]);
  const [countLabel, setCountLabel] = useState<string>("");
  const [dataHealth, setDataHealth] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Form fields for adding farmer
  const [fullName, setFullName] = useState("");
  const [village, setVillage] = useState("");
  const [taluka, setTaluka] = useState("Rahuri");
  const [district, setDistrict] = useState("Ahilya Nagar");
  const [mobile, setMobile] = useState("");

  const t = translations[lang];

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const fResp = await fetch("/api/admin/farmers", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fData = await fResp.json();
      if (fData.success) {
        setFarmersList(fData.farmers || []);
        setCountLabel(fData.count_label || "");
      }

      const hResp = await fetch("/api/admin/data-health", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const hData = await hResp.json();
      if (hData.success) {
        setDataHealth(hData.summary || {});
      }
    } catch (err: any) {
      console.error("Admin load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token]);

  const handleCreateFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch("/api/admin/farmers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName,
          village: village,
          taluka: taluka,
          district: district,
          mobile: mobile
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || data.error || "Failed to add farmer");
      }

      setActionMsg(`शेतकरी यशस्वीरीत्या नोंदवला! ID: ${data.farmer_id}, Password: ${data.one_time_password}`);
      setShowAddModal(false);
      setFullName("");
      setVillage("");
      setMobile("");
      loadAdminData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleResetPassword = async (farmerId: string) => {
    if (!confirm(`शेतकरी ${farmerId} चा पासवर्ड रिसेट करायचा आहे का?`)) return;
    try {
      const resp = await fetch(`/api/admin/farmers/${farmerId}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (data.success) {
        alert(`नवीन तात्पुरता पासवर्ड: ${data.one_time_password}\n(हा पासवर्ड सुरक्षितपणे शेतकऱ्याला द्या.)`);
        loadAdminData();
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleUnlock = async (farmerId: string) => {
    try {
      const resp = await fetch(`/api/admin/farmers/${farmerId}/unlock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (data.success) {
        setActionMsg(`शेतकरी ${farmerId} खाते अनलॉक केले.`);
        loadAdminData();
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      {/* Admin Top Header */}
      <header className="bg-amber-950 text-white px-4 py-3 shadow-md border-b-2 border-amber-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
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
                {countLabel || "Quota: 20 Farmers"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.add_farmer}</span>
            </button>

            <a
              href="/api/admin/credential-cards-batch"
              target="_blank"
              rel="noreferrer"
              className="bg-amber-800 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{t.batch_print}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto p-4 sm:p-6 flex-1 space-y-6">
        {actionMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900 text-xs sm:text-sm font-bold shadow-sm">
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg(null)} className="text-emerald-700">✕</button>
          </div>
        )}

        {/* Data Health Telemetry Panel */}
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-stone-200">
          <h2 className="text-base font-extrabold text-stone-900 mb-3 flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 text-emerald-700" />
            <span>{t.data_health} (Live Sources)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {dataHealth && Object.keys(dataHealth).map(key => {
              const src = dataHealth[key];
              const isOk = src.status === "HEALTHY" || src.status === "OPERATIONAL";
              return (
                <div key={key} className="p-3 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-stone-800">{src.name}</span>
                    {isOk ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>सुरू (OK)</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>तपासा (Degraded)</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500">
                    शेवटची वेळ: {src.last_success ? new Date(src.last_success).toLocaleTimeString() : "Pending"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Registered Farmers Table */}
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-stone-900">
                नोंदणीकृत शेतकरी यादी (Registered Farmers)
              </h2>
              <p className="text-xs text-stone-500">
                कमाल मर्यादा: २० शेतकरी (Hard cap MAX_FARMERS=20)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase text-[11px]">
                  <th className="pb-3 px-2">आयडी (ID)</th>
                  <th className="pb-3 px-2">नाव (Name)</th>
                  <th className="pb-3 px-2">गाव व तालुका</th>
                  <th className="pb-3 px-2">जिल्हा</th>
                  <th className="pb-3 px-2">शेत तुकडे</th>
                  <th className="pb-3 px-2 text-right">कृती (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {farmersList.map(f => (
                  <tr key={f.farmer_id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 px-2 font-mono font-bold text-emerald-900">
                      {f.farmer_id}
                      {f.is_demo && (
                        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-sans">
                          Demo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 font-bold text-stone-800">
                      {f.full_name}
                      {f.is_locked && (
                        <span className="ml-2 text-rose-600 font-semibold text-xs">[Locked]</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-stone-600">
                      {f.village}, {f.taluka}
                    </td>
                    <td className="py-3 px-2 text-stone-600 font-medium">
                      {f.district}
                    </td>
                    <td className="py-3 px-2 font-bold text-emerald-800">
                      {f.parcel_count} तुकडे
                    </td>
                    <td className="py-3 px-2 text-right space-x-1">
                      {f.is_locked && (
                        <button
                          onClick={() => handleUnlock(f.farmer_id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg"
                          title="अनलॉक करा"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleResetPassword(f.farmer_id)}
                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg"
                        title="पासवर्ड रिसेट"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <a
                        href={`/api/admin/credential-card/${f.farmer_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg"
                        title="ओळखपत्र (A6)"
                      >
                        <Printer className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Add Farmer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-black text-stone-900 mb-4">
              नवीन शेतकरी नोंदणी (Add Pilot Farmer)
            </h2>
            <form onSubmit={handleCreateFarmer} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-stone-700 mb-1">शेतकऱ्याचे नाव:</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="उदा. भाऊराव विठ्ठल कदम"
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
                  placeholder="उदा. वांबोरी"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">मोबाईल (पर्यायी):</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="9876543210"
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
    </div>
  );
};
