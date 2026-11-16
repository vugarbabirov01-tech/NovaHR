export type ThemeChoice = "light" | "dark"

export const THEME_STORAGE_KEY = "nova-theme"

/** Runs in <head> before paint: saved choice, else the OS preference. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})();`

export function applyTheme(theme: ThemeChoice): void {
  document.documentElement.classList.toggle("dark", theme === "dark")
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode / blocked storage: the choice just won't persist.
  }
}

/** For useSyncExternalStore: re-renders when the <html> "dark" class flips. */
export function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

export function isDarkNow(): boolean {
  return document.documentElement.classList.contains("dark")
}
