"use client";

import { useSyncExternalStore, useCallback, useRef, useEffect } from "react";
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

/**
 * TEMPORARY DIAGNOSTIC LOGGING.
 *
 * Added to find why the toggle does nothing on one machine while passing every
 * automated test. Remove this block, the `log()` calls and the
 * `window.__themeDebug` assignment once the cause is known — none of it changes
 * behaviour.
 */
const LOG = "[theme]";
function log(...args: unknown[]) {
  console.log(LOG, ...args);
}

/** Everything about the current theme state, in one object. */
function themeState() {
  const el = document.documentElement;
  let stored: string | null | "THREW" = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = "THREW";
  }
  return {
    attr: el.dataset.theme,
    class: el.className,
    sweepClass: el.classList.contains("theme-sweep"),
    stored,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    hasViewTransitions: typeof (document as Document & {
      startViewTransition?: unknown;
    }).startViewTransition,
    reducedMotion:
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/** Minimal shape of what `startViewTransition` hands back. */
type ViewTransitionLike = {
  finished: Promise<void>;
  updateCallbackDone?: Promise<void>;
  skipTransition: () => void;
};

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  /**
   * The transition currently in flight, if any. Rapid clicks must replace it,
   * not queue behind it: without this a held-down toggle builds a backlog of
   * sweeps that keep playing long after the user stopped, and the theme appears
   * to lag their input.
   */
  const active = useRef<ViewTransitionLike | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  /**
   * Whether the press that is currently in progress began on this button —
   * either normally, or swallowed by a running sweep. `pointerup` acts on it,
   * because during a sweep `click` never arrives.
   */
  const pressed = useRef(false);

  const toggle = useCallback(() => {
    log("toggle() called. state before:", themeState());
    /**
     * The theme change itself. A direct DOM write, deliberately not React
     * state: the attribute has to be on <html> before the browser snapshots
     * the "new" state, and `useSyncExternalStore` above reads it back to drive
     * the icon. Nothing here is batched, so there is no `flushSync` to add.
     */
    const applyTheme = () => {
      const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
      log("applyTheme: setting data-theme =", next, "(was", getSnapshot() + ")");
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing can throw; the toggle still works for this page view.
      }
      window.dispatchEvent(new Event(EVENT));
      log("applyTheme: done ->", themeState());
    };

    /**
     * The theme change must happen exactly once, and must survive the animation
     * failing in any way — throwing on call, never invoking its callback, or
     * settling in some manner this code does not anticipate. Every path below
     * calls this, and only the first call does anything.
     */
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      applyTheme();
    };

    // Feature detection, never browser sniffing: any engine without the API
    // just switches instantly, which is a perfectly good theme toggle.
    const start = (
      document as Document & {
        startViewTransition?: (cb: () => void) => ViewTransitionLike;
      }
    ).startViewTransition;

    /**
     * `prefers-reduced-motion` is deliberately NOT consulted here.
     *
     * It was, and it did its job — but on a machine with Windows animation
     * effects switched off (Windows reports MinAnimate = 0) both Chrome and
     * Firefox report `reduce`, so the sweep
     * never played for the person who asked for it. Owner's decision, taken
     * with the accessibility cost stated: the sweep now plays for everyone.
     * See docs/DECISIONS.md.
     *
     * Scoped to this animation only. Reduced-motion handling elsewhere in the
     * app — the `motion-reduce:animate-none` on button spinners, the global
     * rule in globals.css — is untouched.
     */
    if (typeof start !== "function") {
      log("no startViewTransition -> instant path");
      apply();
      return;
    }
    log("startViewTransition present -> animated path");

    // Jump the outgoing sweep to its end before capturing, so the new one
    // snapshots a settled page rather than a half-animated frame.
    active.current?.skipTransition();

    // Class on before the call: startViewTransition captures the old state
    // synchronously, and the class also suppresses the app's own colour
    // transitions, which must be off before `apply` flips the theme.
    document.documentElement.classList.add("theme-sweep");

    let transition: ViewTransitionLike;
    try {
      transition = start.call(document, apply);
    } catch {
      // The animation is decoration. If starting it throws, the theme still
      // changes — a broken sweep must never become a broken toggle.
      document.documentElement.classList.remove("theme-sweep");
      apply();
      return;
    }
    active.current = transition;

    /**
     * Belt and braces for the same rule. If the browser resolves the
     * transition without ever running the callback, or never settles it at
     * all, the theme change still lands. `apply` is idempotent, so on the
     * normal path these are no-ops.
     */
    const settled = transition.updateCallbackDone ?? transition.finished;
    Promise.resolve(settled).then(apply, apply);
    const failsafe = setTimeout(apply, 1000);

    /**
     * A root view transition suppresses painting of everything inside <html>
     * for its duration, and hit testing follows painting. Mid-sweep,
     * `elementFromPoint` returns <html> rather than the link under the cursor —
     * measured, and independent of `pointer-events`, which is `auto` on the
     * root throughout. Nothing in CSS fixes it: it is what capturing the root
     * means.
     *
     * So the first sign of input ends the animation immediately. Measured
     * effect: hit testing is restored within the same `pointerdown`, and the
     * page is fully live from that moment. The click that carried that
     * pointerdown is still lost, because the browser had already resolved its
     * target to <html> before the listener ran and `click` fires on the common
     * ancestor of the down and up targets — so a scroll or a second click
     * works, that one does not. See docs/DECISIONS.md.
     *
     * `wheel` is included because a frozen snapshot that ignores scrolling is
     * the most alarming version of this.
     */
    const INPUT = ["pointerdown", "keydown", "wheel"] as const;
    const onInput = (e: Event) => {
      transition.skipTransition();
      // If that press landed on the toggle itself, its `click` is already lost:
      // the target resolved to <html> before the skip, so the click fires on the
      // common ancestor of <html> and the button, which is <html>. The pointerup
      // that follows DOES reach the button, because skipping restored hit
      // testing — so record the press and let pointerup do the work.
      if (e.type !== "pointerdown") return;
      const r = button.current?.getBoundingClientRect();
      const p = e as PointerEvent;
      pressed.current =
        !!r &&
        p.clientX >= r.left &&
        p.clientX <= r.right &&
        p.clientY >= r.top &&
        p.clientY <= r.bottom;
    };
    for (const type of INPUT) {
      window.addEventListener(type, onInput, { capture: true, once: true });
    }

    const done = () => {
      clearTimeout(failsafe);
      for (const type of INPUT) {
        window.removeEventListener(type, onInput, { capture: true });
      }
      // Only the newest transition may clear the class; an older one finishing
      // late would otherwise strip the sweep off the one still running.
      if (active.current !== transition) return;
      active.current = null;
      document.documentElement.classList.remove("theme-sweep");
    };
    transition.finished.then(done, done);
  }, []);

  const Icon = theme === "dark" ? Sun : Moon;

  // Proves the component hydrated and handlers are attached. If this never
  // appears in the console, no click could possibly work: React did not take
  // over the markup.
  useEffect(() => {
    log("ThemeToggle hydrated. state:", themeState());
    (window as unknown as { __themeDebug: () => unknown }).__themeDebug = () => {
      const s = themeState();
      log("__themeDebug():", s);
      return s;
    };
    log("run window.__themeDebug() at any time to dump state.");
  }, []);

  return (
    <button
      ref={button}
      type="button"
      // Driven by pointerup rather than click. A sweep started by the previous
      // press makes the root's descendants un-hit-testable, so `click` resolves
      // to <html> and never reaches this button — which meant every second
      // press did nothing at all while an animation was running. `pointerup`
      // arrives either way.
      onPointerDown={(e) => {
        log("onPointerDown fired. pointerType =", e.pointerType, "button =", e.button);
        pressed.current = true;
      }}
      onPointerUp={(e) => {
        log("onPointerUp fired. pressed =", pressed.current, "pointerType =", e.pointerType);
        if (!pressed.current) return;
        pressed.current = false;
        toggle();
        // Confirm the DOM really changed, a frame after the handler returns.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => log("one frame later:", themeState())),
        );
      }}
      // Dragging off the button, or the browser taking the pointer away,
      // abandons the press — otherwise a release back over the button later
      // would toggle from a press that was never meant for it.
      onPointerLeave={() => {
        pressed.current = false;
      }}
      onPointerCancel={() => {
        pressed.current = false;
      }}
      // Keyboard activation only. Enter and Space synthesise a click with no
      // pointer events behind it, and those report `detail === 0`; a real mouse
      // click reports 1 or more and has already been handled above.
      onClick={(e) => {
        log("onClick fired. detail =", e.detail, "(0 means keyboard)");
        if (e.detail === 0) toggle();
      }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border border-line bg-card text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink sm:size-9"
    >
      <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}

/** Runs before paint so the stored theme is applied without a flash. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;
