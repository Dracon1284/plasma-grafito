import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "fr", label: "FR" },
];

export function Navbar({ right }: { right?: ReactNode }) {
  const { i18n } = useTranslation();
  const current = i18n.language.slice(0, 2); // "en", "es" o "fr"

  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-graphite/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-3 group">
          <span className="w-2 h-2 rounded-full bg-plasma-blue shadow-glow-blue animate-glow-pulse" />
          <span className="font-display tracking-[0.25em] text-plasma-blue neon-text group-hover:text-plasma-magenta group-hover:neon-text-magenta transition-colors">
            PLASMA · GRAFITO
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Selector de idioma */}
          <div className="flex items-center gap-1 border border-white/10 rounded px-1 py-0.5">
            {LANGS.map(({ code, label }, idx) => (
              <span key={code} className="flex items-center">
                {idx > 0 && <span className="text-white/20 text-xs mx-0.5">|</span>}
                <button
                  onClick={() => i18n.changeLanguage(code)}
                  className={`font-display text-[10px] tracking-widest px-1.5 py-0.5 rounded transition-colors
                    ${current === code
                      ? "text-plasma-blue"
                      : "text-text-muted hover:text-text-neon"
                    }`}
                >
                  {label}
                </button>
              </span>
            ))}
          </div>

          {right && <div className="flex items-center gap-3">{right}</div>}
        </div>
      </div>
    </header>
  );
}
