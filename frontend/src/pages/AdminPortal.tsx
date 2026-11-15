import React, { useState, useEffect, useCallback } from "react";
import { Language, translations } from "../i18n/translations";
import { computeSunTheme } from "../utils/sunEngine";
import { LivingBackground } from "../components/LivingBackground";
import { FarmMap } from "../components/FarmMap";
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
  FileCheck2,
  MapPin,
  LogOut,
  Compass,
  QrCode,
  Search,
  Edit3
} from "lucide-react";

interface AdminPortalProps {
  token: string;
  lang: Language;
  tier?: "full" | "lite";
  onBack: () => void;
  onLogout?: () => void;
  onOpenInstallModal?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  token,
  lang,
  tier = "full",
  onBack,
  onLogout,
  onOpenInstallModal
}) => {
  const [overview, setOverview] = useState<any>(null);
  const [talukaOptions, setTalukaOptions] = useState<{ name: string; district: string }[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showAnnModal, setShowAnnModal] = useState<boolean>(false);
  const [mappingFarmer, setMappingFarmer] = useState<any | null>(null);
  const [editingFarmer, setEditingFarmer] = useState<any | null>(null);
  const [sunTheme] = useState(() => computeSunTheme());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [issuedPasswords, setIssuedPasswords] = useState<Record<string, string>>({});

  // Roster search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [districtFilter, setDistrictFilter] = useState<"ALL" | "Ahilya Nagar" | "Nashik">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "LOCKED" | "UNMAPPED">("ALL");

  // Create farmer form state
  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
  const [taluka, setTaluka] = useState("Rahuri");
  const [district, setDistrict] = useState("Ahilya Nagar");
  const [mobile, setMobile] = useState("");
  const [holderRelation, setHolderRelation] = useState("");
  const [farmerCategory, setFarmerCategory] = useState("small");
  const [primaryCrops, setPrimaryCrops] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [bioNote, setBioNote] = useState("");

  // Edit farmer form state
  const [editName, setEditName] = useState("");
  const [editDistrict, setEditDistrict] = useState("Ahilya Nagar");
  const [editTaluka, setEditTaluka] = useState("Rahuri");
  const [editVillage, setEditVillage] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editRelation, setEditRelation] = useState("");
  const [editCategory, setEditCategory] = useState("small");
  const [editPrimaryCrops, setEditPrimaryCrops] = useState("");
  const [editExpYears, setEditExpYears] = useState("");
  const [editBioNote, setEditBioNote] = useState("");

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

  useEffect(() => {
    fetch("/api/v1/geo/talukas")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data?.talukas)) {
          setTalukaOptions(data.talukas);
        }
      })
      .catch(() => {});
  }, []);

  const openEditFarmerModal = (f: any) => {
    setEditingFarmer(f);
    setEditName(f.name || "");
    setEditDistrict(f.district || "Ahilya Nagar");
    setEditTaluka(f.taluka || "Rahuri");
    setEditVillage(f.village || "");
    setEditMobile(f.mobile || "");
    setEditRelation(f.holder_relation || "");
    setEditCategory(f.farmer_category || "small");
    setEditPrimaryCrops(f.primary_crops || "");
    setEditExpYears(
      f.farming_experience_years !== null && f.farming_experience_years !== undefined
        ? String(f.farming_experience_years)
        : ""
    );
    setEditBioNote(f.bio_note || "");
  };

  const handleUpdateFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFarmer) return;
    try {
      const resp = await fetch(`/api/v1/admin/farmers/${editingFarmer.farmer_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          district: editDistrict,
          taluka: editTaluka,
          village: editVillage,
          mobile: editMobile,
          holder_relation: editRelation,
          farmer_category: editCategory,
          primary_crops: editPrimaryCrops,
          farming_experience_years: editExpYears ? Number(editExpYears) : null,
          bio_note: editBioNote
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || "Update failed");
      }
      setActionMsg(`शेतकरी ${editingFarmer.farmer_id} (${editName}) माहिती अद्ययावत झाली!`);
      setEditingFarmer(null);
      loadOverview();
    } catch (err: any) {
      setActionMsg(`त्रुटी: ${err.message}`);
    }
  };

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
          holder_relation: holderRelation,
          farmer_category: farmerCategory,
          primary_crops: primaryCrops,
          farming_experience_years: experienceYears ? Number(experienceYears) : null,
          bio_note: bioNote,
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
      setHolderRelation("");
      setFarmerCategory("small");
      setPrimaryCrops("");
      setExperienceYears("");
      setBioNote("");
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
        setActionMsg(`शेतकरी ${farmerId} खाते हटवले (४० शेतकरी मर्यादेत १ जागा मोकळी झाली).`);
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

  const capacity = overview?.capacity || { active_farmers: 0, max_farmers: 40, remaining_slots: 40 };
  const farmersList = overview?.farmers || [];
  const sourceHealth = overview?.source_health || [];
  const auditLogs = overview?.audit_logs || [];
  const feedbackList = overview?.feedback || [];

  const filteredFarmers = farmersList.filter((f: any) => {
    if (districtFilter !== "ALL" && f.district !== districtFilter) return false;
    if (statusFilter === "LOCKED" && !f.is_locked) return false;
    if (statusFilter === "UNMAPPED" && (f.parcels || []).length > 0) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      f.farmer_id,
      f.name,
      f.village,
      f.taluka,
      f.district,
      f.primary_crops,
      f.holder_relation
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const districtTalukas = (dist: string) => {
    const filtered = talukaOptions.filter(opt => !dist || dist === "All" || opt.district === dist);
    return filtered;
  };

  const totalMappedParcels = farmersList.reduce(
    (sum: number, f: any) => sum + ((f.parcels || []).length || 0),
    0
  );
  const verifiedParcelsCount = farmersList.reduce(
    (sum: number, f: any) =>
      sum + ((f.parcels || []).filter((p: any) => p.land_verified).length || 0),
    0
  );
  const totalMappedAcres = farmersList.reduce(
    (sum: number, f: any) =>
      sum +
      (f.parcels || []).reduce(
        (pSum: number, p: any) => pSum + (Number(p.area_acres) || 0),
        0
      ),
    0
  );
  const healthySourcesCount = sourceHealth.filter((s: any) => s.status === "healthy").length;

  return (
    <div className="relative min-h-screen flex flex-col font-sans overflow-x-hidden">
      <LivingBackground
        variant="workspace"
        sunTheme={sunTheme}
        isLiteTier={tier === "lite"}
      />

      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 bg-amber-950/92 backdrop-blur-md text-white px-4 py-3 shadow-lg border-b-2 border-amber-800/80">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="px-2.5 py-1.5 bg-amber-900/80 hover:bg-amber-800 rounded-xl text-amber-100 text-xs font-extrabold flex items-center space-x-1.5 border border-amber-700/60 transition-colors"
              title="Open Farmer Workspace & Field Map"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">शेतकरी डॅशबोर्ड</span>
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

            {onOpenInstallModal && (
              <button
                onClick={onOpenInstallModal}
                className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow border border-emerald-500/40"
                title="Install App / Share QR Code with Farmers"
              >
                <QrCode className="w-4 h-4 text-emerald-300" />
                <span className="hidden md:inline">शेअर / QR अ‍ॅप</span>
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="bg-rose-900/90 hover:bg-rose-800 text-rose-100 px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow border border-rose-700/60"
                title={t.logout}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1 space-y-5">
        {actionMsg && (
          <div className="p-3.5 bg-emerald-50/95 backdrop-blur-sm border border-emerald-400 rounded-2xl flex items-center justify-between text-emerald-950 text-xs sm:text-sm font-bold shadow-xs">
            <span className="font-mono">{actionMsg}</span>
            <button onClick={() => setActionMsg(null)} className="text-emerald-700 ml-3">
              ✕
            </button>
          </div>
        )}

        {/* Executive Precision Telemetry Summary */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3.5 border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-stone-500 block">
              सक्रिय शेतकरी (Active Roster)
            </span>
            <p className="text-xl font-black text-emerald-900 tabular-nums mt-0.5">
              {capacity.active_farmers}{" "}
              <span className="text-xs font-bold text-stone-400">/ {capacity.max_farmers}</span>
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3.5 border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-stone-500 block">
              एकूण नकाशा क्षेत्र (Mapped Acres)
            </span>
            <p className="text-xl font-black text-sky-900 tabular-nums mt-0.5 flex items-center space-x-1.5">
              <Compass className="w-4 h-4 text-sky-600" />
              <span>{totalMappedAcres.toFixed(2)} ac</span>
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3.5 border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-stone-500 block">
              ७/१२ पडताळणी (7/12 Verified)
            </span>
            <p className="text-xl font-black text-amber-900 tabular-nums mt-0.5">
              {verifiedParcelsCount}{" "}
              <span className="text-xs font-bold text-stone-400">/ {totalMappedParcels} plots</span>
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3.5 border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-stone-500 block">
              डेटा स्रोत (Healthy Telemetry)
            </span>
            <p className="text-xl font-black text-stone-900 tabular-nums mt-0.5">
              {healthySourcesCount}{" "}
              <span className="text-xs font-bold text-stone-400">/ {sourceHealth.length || 0} feeds</span>
            </p>
          </div>
        </section>

        {/* 1. Capacity Meter Bar (N of 40) */}
        <section className="bg-white/90 backdrop-blur-md rounded-3xl p-5 shadow-xs border border-stone-200/80">
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-black text-stone-900">
                नोंदणीकृत शेतकरी व ७/१२ शेत पडताळणी (Farmers &amp; Parcel Verification)
              </h2>
              <p className="text-xs text-stone-500">
                शेतकरी आयडी, पासवर्ड रिसेट, अनलॉक, A6 ओळखपत्र प्रिंट आणि ७/१२ पडताळणी ({filteredFarmers.length} / {farmersList.length})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="नाव, गाव, ID, पीक शोधा..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold w-48 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <select
                value={districtFilter}
                onChange={e => setDistrictFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-bold text-stone-700"
              >
                <option value="ALL">सर्व जिल्हे (All)</option>
                <option value="Ahilya Nagar">Ahilya Nagar</option>
                <option value="Nashik">Nashik</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-bold text-stone-700"
              >
                <option value="ALL">सर्व खाती (All Status)</option>
                <option value="UNMAPPED">नकाशा बाकी (0 Plots)</option>
                <option value="LOCKED">लॉक केलेली (Locked)</option>
              </select>
              <button
                onClick={loadOverview}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {farmersList.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-sm font-semibold">
              अजून कोणताही शेतकरी नोंदणीकृत नाही. वरच्या &apos;{t.add_farmer}&apos; बटणावर क्लिक करून पहिला शेतकरी जोडा.
            </div>
          ) : filteredFarmers.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-sm font-semibold">
              शोधलेल्या निकषानुसार कोणताही शेतकरी सापडला नाही.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase text-[11px]">
                    <th className="pb-3 px-2">आयडी (ID)</th>
                    <th className="pb-3 px-2">नाव व प्रोफाइल (Farmer)</th>
                    <th className="pb-3 px-2">गाव / तालुका / पिके</th>
                    <th className="pb-3 px-2">शेत तुकडे (7/12 Verify)</th>
                    <th className="pb-3 px-2 text-right">कृती (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredFarmers.map((f: any) => (
                    <tr key={f.farmer_id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-2 font-mono font-bold text-emerald-900 align-top">
                        <div>{f.farmer_id}</div>
                        {typeof f.total_acres === "number" && f.total_acres > 0 && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-900 text-[10px]">
                            {f.total_acres.toFixed(2)} ac
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top">
                        <div className="font-bold text-stone-800">
                          {f.name}
                          {f.is_locked && (
                            <span className="ml-2 text-rose-600 font-semibold text-xs">
                              [Locked]
                            </span>
                          )}
                        </div>
                        {(f.holder_relation || f.farming_experience_years != null) && (
                          <div className="text-[11px] text-stone-500 mt-0.5">
                            {f.holder_relation}
                            {f.holder_relation && f.farming_experience_years != null ? " • " : ""}
                            {f.farming_experience_years != null
                              ? `${f.farming_experience_years} yrs exp`
                              : ""}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-stone-600 align-top">
                        <div>
                          {f.village}, {f.taluka}, {f.district}
                        </div>
                        {f.primary_crops && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold">
                            {f.primary_crops}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top">
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
                          onClick={() => setMappingFarmer(f)}
                          className="px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-lg inline-flex items-center space-x-1 text-[11px] font-extrabold border border-sky-200 align-middle"
                          title="शेतकरी जमिनीचा नकाशा आखा (Map Farmer Land)"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">नकाशा</span>
                        </button>
                        <button
                          onClick={() => openEditFarmerModal(f)}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg"
                          title="शेतकरी माहिती बदला (Edit Profile)"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl my-6">
            <h2 className="text-xl font-black text-stone-900 mb-4">
              नवीन शेतकरी नोंदणी ({capacity.active_farmers + 1} of {capacity.max_farmers})
            </h2>
            <form onSubmit={handleCreateFarmer} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                <div>
                  <label className="block font-bold text-stone-700 mb-1">पालक / नातेसंबंध (ऐच्छिक):</label>
                  <input
                    type="text"
                    value={holderRelation}
                    onChange={e => setHolderRelation(e.target.value)}
                    placeholder="उदा. रा. प्र. देशमुख"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">जिल्हा:</label>
                  <select
                    value={district}
                    onChange={e => {
                      const nextDist = e.target.value;
                      setDistrict(nextDist);
                      const firstTal = districtTalukas(nextDist)[0]?.name;
                      setTaluka(firstTal || (nextDist === "Ahilya Nagar" ? "Rahuri" : "Niphad"));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  >
                    <option value="Ahilya Nagar">Ahilya Nagar</option>
                    <option value="Nashik">Nashik</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">तालुका (२९ तालुके):</label>
                  {districtTalukas(district).length > 0 ? (
                    <select
                      value={taluka}
                      onChange={e => setTaluka(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                    >
                      {districtTalukas(district).map(opt => (
                        <option key={opt.name} value={opt.name}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={taluka}
                      onChange={e => setTaluka(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
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
                    मोबाईल क्र. (AES एनक्रिप्टेड):
                  </label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">धारणा प्रकार (Category):</label>
                  <select
                    value={farmerCategory}
                    onChange={e => setFarmerCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  >
                    <option value="marginal">अत्यल्पभूधारक (&lt; 2.5 ac)</option>
                    <option value="small">अल्पभूधारक (2.5 - 5 ac)</option>
                    <option value="semi_medium">मध्यम अल्प (5 - 10 ac)</option>
                    <option value="medium">मध्यम शेतकरी (10+ ac)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">शेती अनुभव (वर्षे):</label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={experienceYears}
                    onChange={e => setExperienceYears(e.target.value)}
                    placeholder="उदा. 14"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">मुख्य पिके (Primary Crops):</label>
                <input
                  type="text"
                  value={primaryCrops}
                  onChange={e => setPrimaryCrops(e.target.value)}
                  placeholder="उदा. कांदा, ऊस, सोयाबीन"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">शेती व सिंचन टीप (पर्यायी):</label>
                <input
                  type="text"
                  value={bioNote}
                  onChange={e => setBioNote(e.target.value)}
                  placeholder="उदा. ठिबक सिंचन + विहीर, गांडूळ खत वापर"
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

      {/* Edit Farmer Profile Modal */}
      {editingFarmer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl my-6">
            <h2 className="text-xl font-black text-stone-900 mb-1">
              शेतकरी माहिती अद्ययावत करा ({editingFarmer.farmer_id})
            </h2>
            <p className="text-xs text-stone-500 mb-4">
              गाव, तालुका, मुख्य पिके, अनुभव व धारणा प्रकार बदला.
            </p>
            <form onSubmit={handleUpdateFarmer} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">पूर्ण नाव:</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">नातेसंबंध:</label>
                  <input
                    type="text"
                    value={editRelation}
                    onChange={e => setEditRelation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">जिल्हा:</label>
                  <select
                    value={editDistrict}
                    onChange={e => {
                      const nextDist = e.target.value;
                      setEditDistrict(nextDist);
                      const firstTal = districtTalukas(nextDist)[0]?.name;
                      if (firstTal) setEditTaluka(firstTal);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  >
                    <option value="Ahilya Nagar">Ahilya Nagar</option>
                    <option value="Nashik">Nashik</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">तालुका:</label>
                  {districtTalukas(editDistrict).length > 0 ? (
                    <select
                      value={editTaluka}
                      onChange={e => setEditTaluka(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                    >
                      {districtTalukas(editDistrict).map(opt => (
                        <option key={opt.name} value={opt.name}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={editTaluka}
                      onChange={e => setEditTaluka(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">गाव:</label>
                  <input
                    type="text"
                    required
                    value={editVillage}
                    onChange={e => setEditVillage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">मोबाईल क्र.:</label>
                  <input
                    type="tel"
                    value={editMobile}
                    onChange={e => setEditMobile(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">प्रकार:</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  >
                    <option value="marginal">अत्यल्पभूधारक (&lt; 2.5 ac)</option>
                    <option value="small">अल्पभूधारक (2.5 - 5 ac)</option>
                    <option value="semi_medium">मध्यम अल्प (5 - 10 ac)</option>
                    <option value="medium">मध्यम शेतकरी (10+ ac)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">शेती अनुभव (वर्षे):</label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={editExpYears}
                    onChange={e => setEditExpYears(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">मुख्य पिके:</label>
                <input
                  type="text"
                  value={editPrimaryCrops}
                  onChange={e => setEditPrimaryCrops(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">शेती टीप:</label>
                <input
                  type="text"
                  value={editBioNote}
                  onChange={e => setEditBioNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                />
              </div>
              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingFarmer(null)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 font-bold text-white shadow"
                >
                  माहिती जतन करा
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
                  {districtTalukas(annDistrict).length > 0 ? (
                    <select
                      value={annTaluka}
                      onChange={e => setAnnTaluka(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                    >
                      <option value="">सर्व तालुके (All)</option>
                      {districtTalukas(annDistrict).map(opt => (
                        <option key={opt.name} value={opt.name}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={annTaluka}
                      onChange={e => setAnnTaluka(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-semibold"
                    />
                  )}
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

      {/* Officer GIS Land Mapping Modal for Selected Farmer */}
      {mappingFarmer && (() => {
        const liveFarmer =
          farmersList.find((x: any) => x.farmer_id === mappingFarmer.farmer_id) || mappingFarmer;
        const farmerParcels = liveFarmer.parcels || [];
        return (
          <FarmMap
            parcels={farmerParcels}
            activeParcel={farmerParcels[0] || null}
            targetFarmerId={liveFarmer.farmer_id}
            targetFarmerName={liveFarmer.name}
            defaultDistrict={liveFarmer.district}
            defaultTaluka={liveFarmer.taluka}
            token={token}
            lang={lang}
            onClose={() => setMappingFarmer(null)}
            onParcelChanged={loadOverview}
          />
        );
      })()}
    </div>
  );
};
