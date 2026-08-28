"use client";

import { useSyncExternalStore, useCallback } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

const STORAGE_KEY = "exsaverse-theme";
const EVENT = "exsaverse-theme-change";

/**
 * The theme lives on <html data-theme> — an external store, not React state.
 * useSyncExternalStore reads it directly, which avoids the setState-in-effect
 * pattern and keeps server and client renders consistent.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Dark is the default — the audience skews that way. */
function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can throw; the toggle still works for this page view.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border border-line bg-card text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink sm:size-9"
    >
      <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}

/** Runs before paint so the stored theme is applied without a flash. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;
