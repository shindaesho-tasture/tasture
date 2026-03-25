import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { t as translate } from "./i18n";

export type AppLanguage = "th" | "en" | "ja" | "zh" | "ko";

export interface LanguageOption {
  code: AppLanguage;
  flag: string;
  label: string;
  nativeLabel: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "th", flag: "🇹🇭", label: "ไทย", nativeLabel: "ภาษาไทย" },
  { code: "en", flag: "🇺🇸", label: "English", nativeLabel: "English" },
  { code: "ja", flag: "🇯🇵", label: "日本語", nativeLabel: "日本語" },
  { code: "zh", flag: "🇨🇳", label: "中文", nativeLabel: "中文" },
  { code: "ko", flag: "🇰🇷", label: "한국어", nativeLabel: "한국어" },
];

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  currentOption: LanguageOption;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "tasture-app-language";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLang] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as AppLanguage;
    } catch {}
    return "th";
  });

  const setLanguage = (lang: AppLanguage) => {
    setLang(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  };

  const currentOption = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, language, params),
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, currentOption, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
