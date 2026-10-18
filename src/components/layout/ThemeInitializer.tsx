"use client";

import { useEffect } from "react";
import { applyThemePreference, isThemePreference, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

/** New installs start in Midnight Scholar (dark); saved preferences always win. */
export default function ThemeInitializer() {
  useEffect(() => {
    const readPreference = (): ThemePreference => {
      try {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (isThemePreference(saved)) return saved;
        window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
      } catch {
        // Storage can be disabled; fall back to the product's dark-first default.
      }
      return "dark";
    };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySaved = () => applyThemePreference(readPreference(), media.matches);
    applySaved();
    media.addEventListener("change", applySaved);
    return () => media.removeEventListener("change", applySaved);
  }, []);

  return null;
}
