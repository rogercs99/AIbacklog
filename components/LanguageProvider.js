"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const LanguageContext = createContext({
  lang: "es",
  setLang: () => {},
  t: (esText, enText) => esText,
});

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("es");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("req2backlog_lang");
    if (stored === "en" || stored === "es") {
      setLang(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("req2backlog_lang", lang);
    if (document?.documentElement) {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const t = useMemo(() => {
    return (esText, enText) => {
      if (lang === "en") {
        return enText || esText;
      }
      return esText;
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
