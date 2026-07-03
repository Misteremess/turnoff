"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Briefcase, BarChart3, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Calendario", icon: CalendarDays },
  { href: "/services", label: "Servicios", icon: Briefcase },
  { href: "/reports", label: "Informes", icon: BarChart3 },
];

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-xl text-white shadow-lg shadow-blue-600/30",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
      )}
      style={{ background: "linear-gradient(135deg, #3b82f6, #4f46e5)" }}
    >
      <ShieldCheck size={size === "sm" ? 17 : 21} />
    </span>
  );
}

export function Nav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Móvil: cabecera superior */}
      <header className="app-nav-collapse sticky top-0 z-40 flex items-center justify-between border-b bg-white/80 px-4 py-2.5 backdrop-blur-md md:hidden dark:bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <div>
            <p className="text-sm font-bold leading-none tracking-tight">TurnOff</p>
            <p className="mt-0.5 text-[10px] leading-none text-[var(--muted)]">
              Gestión de turnos
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          aria-label="Cerrar sesión"
          className="rounded-xl p-2 text-[var(--muted)] transition-colors hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-800"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Escritorio: sidebar */}
      <aside className="app-nav-collapse sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-white/60 px-4 py-8 backdrop-blur-md md:flex dark:bg-slate-900/60">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Logo />
          <div>
            <p className="font-bold leading-tight tracking-tight">TurnOff</p>
            <p className="text-xs text-[var(--muted)]">Gestión de turnos</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium",
                  "transition-all duration-200",
                  active
                    ? "text-white shadow-md shadow-blue-600/25"
                    : "text-slate-600 hover:bg-white hover:text-[var(--foreground)] hover:shadow-sm dark:text-slate-400 dark:hover:bg-slate-800",
                )}
                style={
                  active
                    ? { background: "linear-gradient(135deg, #3b82f6, #4f46e5)" }
                    : undefined
                }
              >
                <Icon
                  size={18}
                  className={cn(
                    "transition-transform duration-200",
                    !active && "group-hover:scale-110 group-hover:text-[var(--primary)]",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t pt-4">
          {email && (
            <p className="mb-2 truncate px-2 text-xs text-[var(--muted)]" title={email}>
              {email}
            </p>
          )}
          <button onClick={signOut} className="btn btn-outline w-full">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Móvil: barra de pestañas inferior */}
      <nav
        className="app-nav-collapse fixed inset-x-0 bottom-0 z-40 border-t bg-white/90 backdrop-blur-md md:hidden dark:bg-slate-900/90"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200",
                    active
                      ? "bg-blue-600/10 text-[var(--primary)]"
                      : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  <Icon size={20} />
                </span>
                <span
                  className={cn(
                    "transition-colors",
                    active ? "text-[var(--primary)]" : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
