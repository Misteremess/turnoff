"use client";

import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark" | "black" | "gray";

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Automático" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "black", label: "Negro" },
  { value: "gray", label: "Gris" },
];

const THEME_EVENT = "turnoff-theme-change";

function getSnapshot(): Theme {
  return (localStorage.getItem("theme") as Theme | null) ?? "system";
}

/** En el servidor no hay localStorage: usamos "system", igual que el script
 * inline del layout antes de hidratar. */
function getServerSnapshot(): Theme {
  return "system";
}

/** No hay un evento nativo para "cambié esta clave de localStorage en esta
 * misma pestaña" (el evento `storage` solo llega a OTRAS pestañas), así que
 * usamos uno propio para que los varios <ThemeToggle> montados a la vez
 * (cabecera móvil + sidebar de escritorio) se mantengan sincronizados. */
function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => window.removeEventListener(THEME_EVENT, onStoreChange);
}

function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

/**
 * Selector de tema (claro/oscuro/negro/gris/automático). Se guarda en
 * localStorage y se aplica vía data-theme en <html> (ver globals.css); un
 * script inline en el layout lo aplica antes de pintar para no dar un
 * flash con el tema equivocado.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function onChange(value: Theme) {
    localStorage.setItem("theme", value);
    applyTheme(value);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <div className={className}>
      <select
        className="select py-1.5 text-xs"
        value={theme}
        onChange={(e) => onChange(e.target.value as Theme)}
        aria-label="Tema"
      >
        {THEMES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
