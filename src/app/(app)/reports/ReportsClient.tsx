"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, FileDown, Sheet, Clock, Euro,
  CalendarCheck, Plus, Trash2, Wallet,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { PayrollConfig, ShiftWithService } from "@/lib/types";
import {
  shiftBreakdown, shiftHours, sumBreakdown, totalsByService,
  monthlyExtrasTotal, monthAccrual, monthPayout,
} from "@/lib/payroll";
import { cn, formatCurrency, formatHours } from "@/lib/utils";
import { savePayrollSettings } from "./actions";

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ReportsClient({
  shifts,
  month,
  config,
  isDefault,
  prevMonthExtraHours,
}: {
  shifts: ShiftWithService[];
  month: string;
  config: PayrollConfig;
  isDefault: boolean;
  /** Horas extra generadas el mes anterior: se cobran en la nómina de este mes. */
  prevMonthExtraHours: number;
}) {
  const router = useRouter();
  const label = monthLabel(month);
  const prevLabel = monthLabel(shiftMonth(month, -1));
  const nextLabel = monthLabel(shiftMonth(month, 1));
  const byService = totalsByService(shifts, config);
  const breakdown = sumBreakdown(shifts, config);
  // "accrual" = lo que genera este mes (horas extra incluidas, sin pagar aún).
  // "payout" = lo que se COBRA este mes: fijo+pluses de este mes + extra del mes anterior.
  const accrual = monthAccrual(shifts, config);
  const payout = monthPayout(accrual, prevMonthExtraHours, config.overtimeRate);

  function goTo(m: string) {
    router.push(`/reports?month=${m}`);
  }

  function rowsForExport() {
    return [...shifts]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((s) => {
        const b = shiftBreakdown(s, config);
        return {
          Fecha: new Date(s.starts_at).toLocaleDateString("es-ES"),
          Inicio: new Date(s.starts_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          Fin: new Date(s.ends_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          Servicio: s.service?.name ?? "",
          Turno: s.code ?? "",
          Horas: Number(shiftHours(s).toFixed(2)),
          Nocturnas: Number(b.nightHours.toFixed(2)),
          "Dom/Fest": Number(b.festiveHours.toFixed(2)),
          Pluses: Number(b.plusAmount.toFixed(2)),
        };
      });
  }

  function exportExcel() {
    const rows = rowsForExport();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        [],
        [`FIJO DEVENGADO (${payout.ordinaryHours.toFixed(1)} de ${config.monthlyHours} h)`, "", "", "", "", "", "", "", Number(payout.fixedEarned.toFixed(2))],
        [`HORAS EXTRA DE ${prevLabel.toUpperCase()} (${payout.extraHoursPaid.toFixed(1)} h × ${config.overtimeRate})`, "", "", "", "", "", "", "", Number(payout.overtimeAmount.toFixed(2))],
        ["PLUSES (nocturno + dom/fest)", "", "", "", "", "", "", "", Number(payout.plusAmount.toFixed(2))],
        ["TOTAL COBRADO ESTE MES", "", "", "", "", "", "", "", Number(payout.grandTotal.toFixed(2))],
        [`Horas extra generadas este mes (se cobran en ${nextLabel})`, "", "", "", "", "", "", "", Number(accrual.extraHours.toFixed(1))],
      ],
      { origin: -1 },
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Turnos");
    XLSX.writeFile(wb, `turnoff-${month}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`TurnOff — Informe ${label}`, 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Cobrado este mes: Fijo ${formatCurrency(payout.fixedEarned)} + Extra de ${prevLabel} ${formatCurrency(payout.overtimeAmount)} + Pluses ${formatCurrency(payout.plusAmount)} = ${formatCurrency(payout.grandTotal)}`,
      14,
      26,
    );
    if (accrual.extraHours > 0.01) {
      doc.text(
        `Genera ${formatHours(accrual.extraHours)} extra este mes, se cobran en la nómina de ${nextLabel}.`,
        14,
        32,
      );
    }

    autoTable(doc, {
      startY: accrual.extraHours > 0.01 ? 38 : 32,
      head: [["Fecha", "Inicio", "Fin", "Servicio", "Turno", "Horas", "Noct.", "Dom/Fest", "Pluses"]],
      body: rowsForExport().map((r) => [
        r.Fecha, r.Inicio, r.Fin, r.Servicio, r.Turno,
        formatHours(r.Horas),
        r.Nocturnas ? formatHours(r.Nocturnas) : "—",
        r["Dom/Fest"] ? formatHours(r["Dom/Fest"]) : "—",
        formatCurrency(r.Pluses),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`turnoff-${month}.pdf`);
  }

  return (
    <div className="animate-rise">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Informes</h1>
          <p className="text-sm text-[var(--muted)]">Resumen de horas y sueldo estimado.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => goTo(shiftMonth(month, -1))} className="btn btn-outline px-2" aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-40 text-center font-medium capitalize">{label}</span>
          <button onClick={() => goTo(shiftMonth(month, 1))} className="btn btn-outline px-2" aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Horas trabajadas"
          value={formatHours(accrual.workedHours)}
          sub={
            accrual.extraHours > 0.01
              ? `Jornada ${config.monthlyHours}h + ${formatHours(accrual.extraHours)} extra → se cobran en ${nextLabel}`
              : `de ${config.monthlyHours}h de jornada`
          }
          icon={Clock}
        />
        <StatCard
          label="Sueldo a cobrar este mes"
          value={formatCurrency(payout.grandTotal)}
          sub={`${formatCurrency(payout.fixedEarned)} fijo · ${formatCurrency(payout.overtimeAmount)} extra (${prevLabel}) · ${formatCurrency(payout.plusAmount)} pluses`}
          icon={Euro}
          accent
        />
        <StatCard label="Turnos" value={String(shifts.length)} icon={CalendarCheck} />
      </div>

      {accrual.extraHours > 0.01 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Este mes generas <strong>{formatHours(accrual.extraHours)}</strong> de horas
          extra. Al cobrarse <strong>a mes vencido</strong>, se pagarán (a{" "}
          {formatCurrency(config.overtimeRate)}/h) en la nómina de{" "}
          <strong className="capitalize">{nextLabel}</strong>, no en esta.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {shifts.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-4 font-semibold">Horas por servicio</h2>
            <div className="space-y-4">
              {byService.map((r) => {
                const max = byService[0]?.hours || 1;
                const pct = Math.max(4, (r.hours / max) * 100);
                return (
                  <div key={r.serviceId}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                        <span className="truncate">{r.serviceName}</span>
                      </span>
                      <span className="shrink-0">
                        <span className="font-semibold">{formatHours(r.hours)}</span>
                        {r.plus > 0.01 && <span className="text-[var(--muted)]"> · +{formatCurrency(r.plus)}</span>}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: r.color,
                          transition: "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {shifts.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Nómina cobrada este mes</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">
              El fijo cubre la jornada de {config.monthlyHours}h de este mes. Las
              horas extra se cobran <strong>a mes vencido</strong>: aquí se paga
              el exceso generado en {prevLabel}. Los pluses (nocturno, domingo/
              festivo) sí se cobran el mismo mes en que se trabajan.
            </p>
            <div className="space-y-3 text-sm">
              <Row
                label={`Fijo devengado (${formatHours(payout.ordinaryHours)} de ${config.monthlyHours}h)`}
                value={payout.fixedEarned}
              />
              {payout.extraHoursPaid > 0.01 && (
                <Row
                  label={`Horas extra de ${prevLabel} (${formatHours(payout.extraHoursPaid)} × ${formatCurrency(config.overtimeRate)})`}
                  value={payout.overtimeAmount}
                />
              )}
              {breakdown.nightHours > 0.01 && (
                <Row label={`Plus nocturno (${formatHours(breakdown.nightHours)} × ${formatCurrency(config.nightPlus)})`} value={breakdown.nightAmount} />
              )}
              {breakdown.festiveHours > 0.01 && (
                <Row label={`Plus dom/festivo (${formatHours(breakdown.festiveHours)} × ${formatCurrency(config.festivePlus)})`} value={breakdown.festiveAmount} />
              )}
              <div className="border-t pt-3">
                <Row label="Total estimado" value={payout.grandTotal} bold />
              </div>
            </div>
          </div>
        )}
      </div>

      <PayrollSettingsCard config={config} isDefault={isDefault} />

      {shifts.length === 0 && (
        <div className="card mt-6 p-10 text-center text-[var(--muted)]">
          No hay turnos en {label}.
        </div>
      )}

      {shifts.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={exportPDF} className="btn btn-outline">
            <FileDown size={16} /> Exportar PDF
          </button>
          <button onClick={exportExcel} className="btn btn-outline">
            <Sheet size={16} /> Exportar Excel
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={bold ? "font-semibold" : ""}>{label}</span>
      <span className={cn("shrink-0 tabular-nums", bold ? "text-lg font-bold text-[var(--primary)]" : "font-semibold")}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

/** Editor global de la nómina: fijo mensual, jornada, hora extra y pluses. */
function PayrollSettingsCard({ config, isDefault }: { config: PayrollConfig; isDefault: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(config.monthlyExtras);
  const [hours, setHours] = useState(config.monthlyHours);
  const [otRate, setOtRate] = useState(config.overtimeRate);
  const [nightPlus, setNightPlus] = useState(config.nightPlus);
  const [festivePlus, setFestivePlus] = useState(config.festivePlus);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(id: string, patch: Partial<(typeof items)[number]>) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((e) => e.id !== id));
  }
  function add() {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: "", amount: 0 }]);
  }
  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await savePayrollSettings({
          monthlyExtras: items.filter((e) => e.name.trim()),
          monthlyHours: hours,
          overtimeRate: otRate,
          nightPlus,
          festivePlus,
        });
        setMsg("Guardado ✓");
        router.refresh();
        setTimeout(() => setMsg(null), 3000);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  const totalItems = monthlyExtrasTotal(items);
  const horaOrdinaria = hours > 0 ? totalItems / hours : 0;

  return (
    <div className="card mt-6 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Wallet size={18} className="text-[var(--primary)]" /> Nómina (convenio)
        </h2>
        <span className="text-sm">
          Jornada completa: <span className="font-bold">{formatCurrency(totalItems)}</span>/mes
          <span className="text-[var(--muted)]"> · {formatCurrency(horaOrdinaria)}/h</span>
        </span>
      </div>
      <p className="mb-4 text-xs text-[var(--muted)]">
        Configúralo una sola vez: aplica a todos los servicios.
        {isDefault && " Precargado del convenio de seguridad privada 2026-2030 — revísalo y pulsa Guardar."}
      </p>

      <p className="mb-2 text-sm font-medium">Retribución fija mensual (jornada completa)</p>
      <div className="space-y-2">
        {items.map((e) => (
          <div key={e.id} className="flex items-center gap-2">
            <input
              value={e.name}
              onChange={(ev) => update(e.id, { name: ev.target.value })}
              className="input flex-1"
              placeholder="Concepto (ej: Plus transporte)"
            />
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={e.amount}
                onChange={(ev) => update(e.id, { amount: Number(ev.target.value) || 0 })}
                className="input w-32 pr-7 text-right tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-[var(--muted)]">€</span>
            </div>
            <button onClick={() => remove(e.id)} className="rounded-md p-2 text-[var(--danger)] hover:bg-[var(--danger-soft)]" aria-label="Quitar concepto">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="btn btn-outline mt-2">
        <Plus size={16} /> Añadir concepto
      </button>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Jornada mensual (h)" value={hours} step={0.5} onChange={setHours} />
        <Field label="Hora extra €/h" value={otRate} onChange={setOtRate} />
        <Field label="Plus noche €/h" value={nightPlus} onChange={setNightPlus} />
        <Field label="Plus dom/fest €/h" value={festivePlus} onChange={setFestivePlus} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={isPending} className="btn btn-primary">
          {isPending ? "Guardando…" : "Guardar configuración"}
        </button>
        {msg && <span className="text-sm text-[var(--muted)]">{msg}</span>}
      </div>
    </div>
  );
}

function Field({
  label, value, step = 0.01, onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="input tabular-nums"
      />
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number | string }>;
  accent?: boolean;
}) {
  return (
    <div className="card card-hover flex items-center gap-4 p-5">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          accent ? "text-white shadow-md shadow-blue-600/25" : "bg-[var(--surface-muted)] text-slate-500 dark:text-slate-400",
        )}
        style={accent ? { background: "linear-gradient(135deg, #3b82f6, #4f46e5)" } : undefined}
      >
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
        <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="truncate text-xs text-[var(--muted)]">{sub}</p>}
      </div>
    </div>
  );
}
