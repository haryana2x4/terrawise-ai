import React, { useState, useEffect } from "react";
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
  const [view, setView] = useState<"farmer" | "admin">("farmer");

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("kshetra_lang", newLang);
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
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
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
        onBack={() => setView("farmer")}
      />
    );
  }

  return (
    <FarmerHome
      farmer={farmer}
      token={token}
      lang={lang}
      onLanguageChange={handleLanguageChange}
      onLogout={handleLogout}
      onOpenAdmin={() => setView("admin")}
    />
  );
};

export default App;
