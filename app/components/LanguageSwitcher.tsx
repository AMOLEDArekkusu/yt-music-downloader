"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
] as const;

type LangCode = (typeof LANGUAGES)[number]["code"];

interface LanguageSwitcherProps {
  currentLocale: LangCode;
  onLocaleChange: (locale: LangCode) => void;
}

export default function LanguageSwitcher({
  currentLocale,
  onLocaleChange,
}: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === currentLocale) || LANGUAGES[0];

  return (
    <div className="dropdown" ref={ref}>
      <button
        id="language-switcher"
        className="btn-icon"
        onClick={() => setOpen(!open)}
        aria-label="Switch language"
        title={currentLang.label}
        style={{ fontSize: "16px" }}
      >
        <Globe size={18} />
      </button>

      {open && (
        <div className="dropdown-menu">
          {LANGUAGES.map((lang) => (
            <div
              key={lang.code}
              className={`dropdown-item ${lang.code === currentLocale ? "active" : ""}`}
              onClick={() => {
                onLocaleChange(lang.code);
                setOpen(false);
              }}
            >
              <span style={{ fontSize: "16px" }}>{lang.flag}</span>
              <span>{lang.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { LANGUAGES };
export type { LangCode };
