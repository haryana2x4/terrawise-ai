import React, { useState } from "react";
import { Language } from "./i18n/translations";
import { Login } from "./pages/Login";
import { FarmerHome } from "./pages/FarmerHome";
import { AdminPortal } from "./pages/AdminPortal";

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem("kshetra_lang") as Language) || "mr";
  });
  const [farmer, setFarmer] = useState<any>(() => {
    const saved = localStorage.getItem("kshetra_farmer");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem("kshetra_token") || "";
  });
  const [tier, setTier] = useState<"full" | "lite">(() => {
    const saved = localStorage.getItem("kshetra_tier");
    if (saved === "lite" || saved === "full") return saved;
    if (
      typeof navigator !== "undefined" &&
      navigator.hardwareConcurrency &&
      navigator.hardwareConcurrency < 4
    ) {
      return "lite";
    }
    return "full";
  });
  const [view, setView] = useState<"farmer" | "admin">("farmer");

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("kshetra_lang", newLang);
  };

  const handleToggleTier = () => {
    const nextTier = tier === "full" ? "lite" : "full";
    setTier(nextTier);
    localStorage.setItem("kshetra_tier", nextTier);
  };

  const handleLoginSuccess = (farmerData: any, authToken: string) => {
    setFarmer(farmerData);
    setToken(authToken);
    localStorage.setItem("kshetra_farmer", JSON.stringify(farmerData));
    localStorage.setItem("kshetra_token", authToken);
    if (farmerData.role === "admin") {
      setView("admin");
    } else {
      setView("farmer");
    }
  };

  const handleLogout = () => {
    if (token) {
      fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    setFarmer(null);
    setToken("");
    localStorage.removeItem("kshetra_farmer");
    localStorage.removeItem("kshetra_token");
    setView("farmer");
  };

  if (!farmer || !token) {
    return (
      <Login
        lang={lang}
        tier={tier}
        onToggleTier={handleToggleTier}
        onLanguageChange={handleLanguageChange}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (view === "admin") {
    return (
      <AdminPortal
        token={token}
        lang={lang}
        tier={tier}
        onBack={() => setView("farmer")}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <FarmerHome
      farmer={farmer}
      token={token}
      lang={lang}
      tier={tier}
      onToggleTier={handleToggleTier}
      onLanguageChange={handleLanguageChange}
      onLogout={handleLogout}
      onOpenAdmin={() => setView("admin")}
    />
  );
};

export default App;
