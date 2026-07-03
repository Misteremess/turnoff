"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { Service } from "@/lib/types";
import { shiftBreakdown } from "@/lib/payroll";
import { formatHours } from "@/lib/utils";
import { saveShift, deleteShift } from "@/app/(app)/shifts/actions";

/** Convierte una fecha a valor de <input type="datetime-local"> en hora local. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface ShiftDraft {
  id?: string;
  service_id?: string;
  starts_at: string; // valor datetime-local
  ends_at: string;
  break_minutes?: number;
  code?: string;
  notes?: string;
}

export function ShiftDialog({
  draft,
  services,
  onClose,
}: {
  draft: ShiftDraft;
  services: Service[];
  onClose: () => void;
}) {
  const [serviceId, setServiceId] = useState(draft.service_id ?? services[0]?.id ?? "");
  const [starts, setStarts] = useState(draft.starts_at);
  const [ends, setEnds] = useState(draft.ends_at);
  const [breakMin, setBreakMin] = useState(draft.break_minutes ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Vista previa: horas y de qué tipo (nocturnas 22–06, domingo/festivo).
  // El importe no se muestra por turno porque el sueldo es mensual (jornada).
  let preview = "";
  let previewDetail = "";
  if (starts && ends && new Date(ends) > new Date(starts)) {
    const b = shiftBreakdown({ starts_at: starts, ends_at: ends, break_minutes: breakMin });
    preview = formatHours(b.totalHours);
    const parts: string[] = [];
    if (b.nightHours > 0.01) parts.push(`${formatHours(b.nightHours)} nocturnas`);
    if (b.festiveHours > 0.01) parts.push(`${formatHours(b.festiveHours)} dom/festivo`);
    previewDetail = parts.join(" · ");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!serviceId) return setError("Selecciona un servicio");
    if (new Date(ends) <= new Date(starts)) return setError("La hora de fin debe ser posterior");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await saveShift(formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function onDelete() {
    if (!draft.id) return;
    if (!confirm("¿Eliminar este turno?")) return;
    startTransition(async () => {
      try {
        await deleteShift(draft.id!);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo eliminar");
      }
    });
  }

  if (services.length === 0) {
    return (
      <Modal title="Sin servicios" onClose={onClose}>
        <p className="text-sm text-[var(--muted)]">
          Primero crea un servicio en la sección <strong>Servicios</strong> para poder añadir turnos.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title={draft.id ? "Editar turno" : "Nuevo turno"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {draft.id && <input type="hidden" name="id" value={draft.id} />}

        <div>
          <label className="label">Servicio *</label>
          <select
            name="service_id"
            className="select"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Inicio *</label>
            <input
              type="datetime-local"
              name="starts_at"
              className="input"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Fin *</label>
            <input
              type="datetime-local"
              name="ends_at"
              className="input"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Código</label>
            <input
              name="code"
              className="input px-2 text-center font-semibold"
              defaultValue={draft.code ?? ""}
              placeholder="T"
              maxLength={4}
            />
          </div>
          <div>
            <label className="label">Descanso (min)</label>
            <input
              type="number"
              name="break_minutes"
              min="0"
              className="input"
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div>
          <label className="label">Notas</label>
          <textarea name="notes" rows={2} defaultValue={draft.notes ?? ""} className="input" />
        </div>

        {preview && (
          <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">Duración: </span>
            <span className="font-semibold">{preview}</span>
            {previewDetail && (
              <span className="mt-0.5 block text-xs text-[var(--muted)]">{previewDetail}</span>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {draft.id ? (
            <button type="button" onClick={onDelete} disabled={isPending} className="btn btn-danger">
              <Trash2 size={16} /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary">
              {isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
