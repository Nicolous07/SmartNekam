"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { applyThemePreference, isThemePreference, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "dark", label: "Dark · Midnight Scholar" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
  { value: "amoled", label: "AMOLED Black" },
];

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<ThemePreference>("dark");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(saved)) setTheme(saved);
      else setTheme("dark");
    } catch {
      setTheme("dark");
    }
  }, []);

  function changeTheme(nextValue: string) {
    if (!isThemePreference(nextValue)) return;
    setTheme(nextValue);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextValue);
    } catch {
      // The visual choice still works for the current page without persistent storage.
    }
    applyThemePreference(nextValue);
  }

  return (
    <label className={className ?? "inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"}>
      <Palette aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-500" />
      <span className="sr-only">Chagua theme ya SmartNekam</span>
      <select
        value={theme}
        onChange={(event) => changeTheme(event.target.value)}
        aria-label="Chagua theme ya SmartNekam"
        className="min-w-0 max-w-[185px] cursor-pointer bg-transparent py-2 text-xs font-extrabold outline-none"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-white text-slate-900">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
