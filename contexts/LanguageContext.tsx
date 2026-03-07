import translations from "@/translations.json";
import React, { createContext, useContext, useState } from "react";

export type LangCode = "gu" | "en";

const DEFAULT_LANG: LangCode = "gu";

interface LanguageContextType {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (section: string, key: string) => string;
  tParam: (section: string, key: string, params: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function getTranslation(lang: LangCode, section: string, key: string): string {
  const sectionObj = (translations as Record<LangCode, Record<string, unknown>>)[lang]?.[section];
  if (sectionObj && typeof sectionObj === "object" && key in sectionObj) {
    const v = (sectionObj as Record<string, unknown>)[key];
    return typeof v === "string" ? v : String(v ?? "");
  }
  const fallback = (translations as Record<LangCode, Record<string, unknown>>)[DEFAULT_LANG]?.[section];
  if (fallback && typeof fallback === "object" && key in fallback) {
    const v = (fallback as Record<string, unknown>)[key];
    return typeof v === "string" ? v : String(v ?? "");
  }
  return key;
}

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<LangCode>(DEFAULT_LANG);

  const t: LanguageContextType["t"] = (section, key) =>
    getTranslation(lang, section, key);

  const tParam: LanguageContextType["tParam"] = (section, key, params) => {
    let str = getTranslation(lang, section, key);
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
    return str;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tParam }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
