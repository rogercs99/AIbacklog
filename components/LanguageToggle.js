"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="lang-toggle" role="group" aria-label="Language selector">
      <button
        type="button"
        className={`lang-button ${lang === "es" ? "active" : ""}`}
        onClick={() => setLang("es")}
      >
        ES
      </button>
      <button
        type="button"
        className={`lang-button ${lang === "en" ? "active" : ""}`}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}
