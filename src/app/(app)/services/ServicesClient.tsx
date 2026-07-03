"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Phone, MapPin, Clock } from "lucide-react";
import type { Service, ShiftTemplate } from "@/lib/types";
import { newTemplateId } from "@/lib/templates";
import { Modal } from "@/components/Modal";
import { saveService, deleteService } from "./actions";

const PRESET_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706",
  "#7c3aed", "#0891b2", "#db2777", "#4b5563",
];

export function ServicesClient({ services }: { services: Service[] }) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);

  function newService() {
    setEditing(null);
    setOpen(true);
  }
  function editService(s: Service) {
    setEditing(s);
    setOpen(true);
  }

  return (
    <div className="animate-rise">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servicios</h1>
          <p className="text-sm text-[var(--muted)]">
            Tus clientes/puntos de servicio y sus tarifas.
          </p>
        </div>
        <button onClick={newService} className="btn btn-primary">
          <Plus size={18} /> Nuevo servicio
        </button>
      </header>

      {services.length === 0 ? (
        <div className="card p-10 text-center text-[var(--muted)]">
          Aún no tienes servicios. Crea el primero para empezar a añadir turnos.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} onEdit={() => editService(s)} />
          ))}
        </div>
      )}

      {open && (
        <ServiceModal service={editing} onClose={() => setOpen(false)} colors={PRESET_COLORS} />
      )}
    </div>
  );
}

function ServiceCard({ service, onEdit }: { service: Service; onEdit: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`¿Eliminar "${service.name}"? Se borrarán también sus turnos.`)) return;
    startTransition(async () => {
      try {
        await deleteService(service.id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo eliminar el servicio");
      }
    });
  }

  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="mt-1 h-4 w-4 shrink-0 rounded-full"
            style={{ background: service.color }}
          />
          <div>
            <p className="font-semibold">{service.name}</p>
            {service.templates?.length > 0 && (
              <p className="text-sm text-[var(--muted)]">
                {service.templates.length} {service.templates.length === 1 ? "turno" : "turnos"}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Editar">
            <Pencil size={16} />
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="rounded-md p-2 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            aria-label="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
        {service.address && (
          <p className="flex items-center gap-2">
            <MapPin size={14} /> {service.address}
          </p>
        )}
        {service.contact_phone && (
          <p className="flex items-center gap-2">
            <Phone size={14} /> {service.contact_phone}
            {service.contact_name ? ` · ${service.contact_name}` : ""}
          </p>
        )}
      </div>

      {service.templates?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {service.templates.map((t) => (
            <span
              key={t.id}
              className="badge text-white"
              style={{ background: service.color }}
              title={`${t.code}: ${t.start}–${t.end}`}
            >
              {t.code} {t.start}–{t.end}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceModal({
  service,
  onClose,
  colors,
}: {
  service: Service | null;
  onClose: () => void;
  colors: string[];
}) {
  const router = useRouter();
  const [color, setColor] = useState(service?.color ?? colors[0]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>(service?.templates ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addTemplate() {
    setTemplates((t) => [...t, { id: newTemplateId(), code: "", start: "08:00", end: "16:00" }]);
  }
  function updateTemplate(id: string, patch: Partial<ShiftTemplate>) {
    setTemplates((t) => t.map((tpl) => (tpl.id === id ? { ...tpl, ...patch } : tpl)));
  }
  function removeTemplate(id: string) {
    setTemplates((t) => t.filter((tpl) => tpl.id !== id));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    // Guardamos solo plantillas con código.
    formData.set("templates", JSON.stringify(templates.filter((t) => t.code.trim())));
    startTransition(async () => {
      try {
        await saveService(formData);
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el servicio");
      }
    });
  }

  return (
    <Modal title={service ? "Editar servicio" : "Nuevo servicio"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {service && <input type="hidden" name="id" value={service.id} />}
        <input type="hidden" name="color" value={color} />

        <div>
          <label className="label">Nombre *</label>
          <input name="name" required defaultValue={service?.name ?? ""} className="input" placeholder="Ej: Centro comercial Norte" />
        </div>

        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full ring-offset-2 transition"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted)]">
          El sueldo y los pluses se configuran una sola vez en <strong>Informes</strong>
          {" "}(son de convenio, iguales en todos los servicios). Aquí el servicio
          es solo dónde trabajas y tus turnos-tipo.
        </div>

        <div>
          <label className="label">Dirección</label>
          <input name="address" defaultValue={service?.address ?? ""} className="input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Contacto</label>
            <input name="contact_name" defaultValue={service?.contact_name ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input name="contact_phone" defaultValue={service?.contact_phone ?? ""} className="input" />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0 flex items-center gap-1">
              <Clock size={14} /> Turnos predefinidos
            </label>
            <button type="button" onClick={addTemplate} className="text-sm font-medium text-[var(--primary)]">
              + Añadir
            </button>
          </div>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Códigos y horarios para el “modo pintar”. Si el fin es anterior al inicio, cruza medianoche.
          </p>
          <div className="space-y-2">
            {templates.length === 0 && (
              <p className="text-xs text-[var(--muted)]">Sin turnos. Ej: T 14:00–22:00, G 22:00–07:30.</p>
            )}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <input
                  value={t.code}
                  onChange={(e) => updateTemplate(t.id, { code: e.target.value })}
                  className="input w-14 px-2 text-center font-semibold"
                  placeholder="T"
                  maxLength={4}
                />
                <input
                  type="time"
                  value={t.start}
                  onChange={(e) => updateTemplate(t.id, { start: e.target.value })}
                  className="input px-2"
                />
                <span className="text-[var(--muted)]">–</span>
                <input
                  type="time"
                  value={t.end}
                  onChange={(e) => updateTemplate(t.id, { end: e.target.value })}
                  className="input px-2"
                />
                <button
                  type="button"
                  onClick={() => removeTemplate(t.id)}
                  className="rounded-md p-2 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                  aria-label="Quitar turno"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Notas</label>
          <textarea name="notes" rows={2} defaultValue={service?.notes ?? ""} className="input" />
        </div>

        {error && (
          <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
            {/es la columna|column|templates|schema/i.test(error) && (
              <span className="mt-1 block text-xs">
                Pista: ¿has ejecutado la migración 0003_auto_types.sql en Supabase?
              </span>
            )}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="btn btn-primary">
            {isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
