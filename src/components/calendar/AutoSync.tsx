"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check } from "lucide-react";
import { syncGoogle } from "@/app/(app)/shifts/sync-actions";

// El push (app → Google) ya es instantáneo en cada cambio. Este intervalo solo
// cubre el pull (Google → app) mientras la pestaña está abierta; el cron de
// /api/cron/sync cubre el resto del tiempo.
const INTERVAL_MS = 3 * 60 * 1000;

/** Sincroniza con Google Calendar en segundo plano, sin botón ni intervención del usuario. */
export function AutoSync() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (runningRef.current || document.visibilityState !== "visible") return;
      runningRef.current = true;
      setSyncing(true);
      try {
        const res = await syncGoogle();
        if (!cancelled && res.ok && (res.imported > 0 || res.deleted > 0)) {
          router.refresh();
        }
      } catch {
        // Silencioso: si falla, se reintenta en el siguiente ciclo.
      } finally {
        if (!cancelled) setSyncing(false);
        runningRef.current = false;
      }
    }

    run();
    const id = setInterval(run, INTERVAL_MS);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [router]);

  return (
    <span
      className="flex items-center gap-1.5 text-xs text-[var(--muted)]"
      title="Sincronización automática con Google Calendar"
    >
      {syncing ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
      {syncing ? "Sincronizando…" : "Sincronizado"}
    </span>
  );
}
