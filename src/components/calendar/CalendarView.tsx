"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg } from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import { Plus, Paintbrush, X } from "lucide-react";
import type { Service, ShiftTemplate, ShiftWithService } from "@/lib/types";
import { templateTimes } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { ShiftDialog, toLocalInput, type ShiftDraft } from "./ShiftDialog";
import { AutoSync } from "./AutoSync";
import { updateShiftTimes, stampShift } from "@/app/(app)/shifts/actions";
import { addTemplateToService } from "@/app/(app)/services/actions";

interface Brush {
  serviceId: string;
  serviceName: string;
  color: string;
  template: ShiftTemplate;
}

/** Turno "optimista": pintado en pantalla mientras se guarda en el servidor. */
interface PendingStamp {
  key: string;
  serviceId: string;
  serviceName: string;
  color: string;
  code: string;
  start: Date;
  end: Date;
}

/** ¿El servidor ya confirmó este turno optimista? */
function isConfirmed(p: PendingStamp, shifts: ShiftWithService[]): boolean {
  return shifts.some(
    (s) =>
      s.service_id === p.serviceId &&
      Math.abs(new Date(s.starts_at).getTime() - p.start.getTime()) < 1000,
  );
}

export function CalendarView({
  services,
  shifts,
}: {
  services: Service[];
  shifts: ShiftWithService[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [paintMode, setPaintMode] = useState(false);
  const [brush, setBrush] = useState<Brush | null>(null);
  const [pending, setPending] = useState<PendingStamp[]>([]);
  const [, startTransition] = useTransition();
  const calendarRef = useRef<FullCalendar | null>(null);
  const calendarWrapRef = useRef<HTMLDivElement | null>(null);

  // FullCalendar mide su contenedor al montar; en móvil, el layout flex
  // aún puede no tener su altura definitiva en ese momento (p.ej. antes de
  // que la barra del navegador se asiente), así que se queda con un tamaño
  // incorrecto hasta que algo dispare un resize (como girar la pantalla).
  // Con un ResizeObserver forzamos el recálculo en cuanto el contenedor
  // tenga su tamaño real, sin depender de rotar el dispositivo.
  useEffect(() => {
    const el = calendarWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      calendarRef.current?.getApi().updateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const events = useMemo(() => {
    // Los turnos optimistas desaparecen cuando el servidor los confirma.
    const pendingEvents = pending
      .filter((p) => !isConfirmed(p, shifts))
      .map((p) => {
      const overnight = p.start.getDate() !== p.end.getDate();
      return {
        id: `pending-${p.key}`,
        title: p.code,
        start: p.start,
        end: p.end,
        backgroundColor: p.color,
        borderColor: p.color,
        editable: false,
        classNames: overnight ? ["overnight-bar", "pending-stamp"] : ["pending-stamp"],
        extendedProps: { code: p.code, serviceName: p.serviceName, overnight },
      };
    });

    const shiftEvents = shifts.map((s) => {
        const color = s.service?.color ?? "#2563eb";
        const startD = new Date(s.starts_at);
        const endD = new Date(s.ends_at);
        const overnight =
          startD.getFullYear() !== endD.getFullYear() ||
          startD.getMonth() !== endD.getMonth() ||
          startD.getDate() !== endD.getDate();

        return {
          id: s.id,
          title: s.code ?? s.service?.name ?? "Turno",
          start: s.starts_at,
          end: s.ends_at,
          backgroundColor: color,
          borderColor: color,
          classNames: overnight ? ["overnight-bar"] : [],
          extendedProps: { code: s.code, serviceName: s.service?.name ?? "", overnight },
        };
      });

    return [...shiftEvents, ...pendingEvents];
  }, [shifts, pending]);

  function openNew() {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 8);
    setDraft({ starts_at: toLocalInput(start), ends_at: toLocalInput(end) });
  }

  function togglePaint() {
    setPaintMode((v) => {
      if (v) setBrush(null);
      return !v;
    });
  }

  function onSelect(arg: DateSelectArg) {
    setDraft({ starts_at: toLocalInput(arg.start), ends_at: toLocalInput(arg.end) });
  }

  function onDateClick(arg: DateClickArg) {
    if (!paintMode || !brush) return;
    const { start, end } = templateTimes(arg.date, brush.template);

    // Pintado optimista: el turno aparece al instante, en tono pulsante,
    // y se consolida cuando el servidor confirma.
    const key = crypto.randomUUID();
    setPending((prev) => [
      // De paso purgamos los ya confirmados para que la lista no crezca.
      ...prev.filter((p) => !isConfirmed(p, shifts)),
      {
        key,
        serviceId: brush.serviceId,
        serviceName: brush.serviceName,
        color: brush.color,
        code: brush.template.code,
        start,
        end,
      },
    ]);

    startTransition(async () => {
      try {
        await stampShift({
          serviceId: brush.serviceId,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          code: brush.template.code,
        });
        router.refresh();
      } catch {
        // Si falla el guardado, retiramos el turno optimista.
        setPending((prev) => prev.filter((p) => p.key !== key));
      }
    });
  }

  function onEventClick(arg: EventClickArg) {
    if (paintMode) return; // pintando no se abren turnos, para no interrumpir
    const shift = shifts.find((s) => s.id === arg.event.id);
    if (!shift) return;
    setDraft({
      id: shift.id,
      service_id: shift.service_id,
      starts_at: toLocalInput(new Date(shift.starts_at)),
      ends_at: toLocalInput(new Date(shift.ends_at)),
      break_minutes: shift.break_minutes,
      code: shift.code ?? undefined,
      notes: shift.notes ?? undefined,
    });
  }

  function onEventDrop(arg: EventDropArg | EventResizeDoneArg) {
    const { event } = arg;
    if (!event.start || !event.end) {
      arg.revert();
      return;
    }
    startTransition(async () => {
      try {
        await updateShiftTimes(event.id, event.start!.toISOString(), event.end!.toISOString());
        router.refresh();
      } catch {
        arg.revert();
      }
    });
  }

  return (
    <div className="animate-rise flex min-h-0 flex-1 flex-col">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
          <p className="text-sm text-[var(--muted)]">
            {paintMode
              ? brush
                ? `Pintando ${brush.template.code} (${brush.template.start}–${brush.template.end}) de ${brush.serviceName}: haz clic en los días.`
                : "Elige un servicio y un turno en la paleta para empezar a pintar."
              : "Arrastra en el calendario para crear un turno, o pulsa uno para editarlo."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutoSync />
          <button
            onClick={togglePaint}
            className={cn("btn", paintMode ? "btn-primary" : "btn-outline")}
            disabled={services.length === 0}
            title={
              services.length === 0
                ? "Crea primero un servicio para poder pintar turnos"
                : "Activar/desactivar modo pintar"
            }
          >
            <Paintbrush size={18} /> {paintMode ? "Pintando" : "Modo pintar"}
          </button>
          <button onClick={openNew} className="btn btn-primary">
            <Plus size={18} /> Nuevo turno
          </button>
        </div>
      </header>

      {paintMode && (
        <PaintPalette services={services} brush={brush} onPick={setBrush} onClose={togglePaint} />
      )}

      <div
        ref={calendarWrapRef}
        className={cn(
          "card min-h-[480px] flex-1 p-3 transition-shadow duration-300 sm:p-4 md:min-h-[560px]",
          paintMode && "painting ring-2 ring-[var(--primary)] shadow-lg shadow-blue-500/10",
        )}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          firstDay={1}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día" }}
          height="100%"
          nowIndicator
          selectable={!paintMode}
          selectMirror
          editable={!paintMode}
          eventDisplay="block"
          events={events}
          eventContent={renderEvent}
          select={onSelect}
          dateClick={onDateClick}
          eventClick={onEventClick}
          eventDrop={onEventDrop}
          eventResize={onEventDrop}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>

      {!paintMode && services.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {services.map((s) => (
            <span key={s.id} className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {draft && <ShiftDialog draft={draft} services={services} onClose={() => setDraft(null)} />}
    </div>
  );
}

function fmtTime(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function renderEvent(arg: EventContentArg) {
  const { event, isStart, isEnd, view } = arg;
  const xp = event.extendedProps as {
    code?: string;
    serviceName?: string;
    overnight?: boolean;
  };
  const start = fmtTime(event.start);
  const end = fmtTime(event.end);
  const title = `${xp.serviceName ?? ""} · ${start}–${end}`;
  const isMonth = view.type === "dayGridMonth";

  // Línea principal (código + horas) y debajo el servicio, para no confundir
  // turnos de servicios distintos.
  const body = (moon: boolean) => (
    <div className="min-w-0 overflow-hidden px-0.5 leading-tight">
      <div className="flex items-center gap-1">
        {xp.code && <span className="font-bold">{xp.code}</span>}
        <span className="truncate opacity-95">{start}–{end}</span>
        {moon && <span className="ml-auto">🌙</span>}
      </div>
      {xp.serviceName && (
        <div className="evt-service truncate text-[0.65rem] font-normal opacity-85">
          {xp.serviceName}
        </div>
      )}
    </div>
  );

  // Turno nocturno en vista mes: UNA barra continua que cruza los dos días;
  // la mitad derecha (día de salida) lleva el distintivo "Saliente" integrado.
  if (xp.overnight && isMonth) {
    // Barra completa (entrada y salida en la misma semana). Las dos mitades
    // van a ras (sin padding externo ni hueco) para que el rayado empiece
    // exactamente en la frontera entre los dos días.
    if (isStart && isEnd) {
      return (
        <div className="flex w-full items-stretch overflow-hidden" title={`${title} (nocturno)`}>
          <span className="min-w-0 flex-1 px-1">{body(true)}</span>
          <span className="saliente-half flex min-w-0 flex-1 items-center justify-center gap-1 px-1.5">
            🌙 <span className="truncate"><span className="font-bold">Saliente</span> {end}</span>
          </span>
        </div>
      );
    }
    // La semana acaba entre medias (ej. domingo→lunes): tramo de entrada…
    if (isStart) {
      return (
        <div className="px-1" title={`${title} (nocturno)`}>
          {body(true)}
        </div>
      );
    }
    // …y tramo de salida en la semana siguiente.
    return (
      <div className="saliente-half flex items-center gap-1 overflow-hidden" title={`${title} (saliente de noche)`}>
        <span>🌙</span>
        <span className="truncate">
          <span className="font-bold">Saliente</span> {end}
        </span>
      </div>
    );
  }

  // Turno normal (o vistas semana/día, donde el turno ya se dibuja a su hora).
  return <div title={title}>{body(Boolean(xp.overnight) && !isMonth)}</div>;
}

/**
 * Paleta del modo pintar: 1) eliges servicio, 2) aparecen sus turnos,
 * 3) eliges el turno y pintas en el calendario. Permite añadir turnos
 * nuevos al servicio sin salir del calendario.
 */
function PaintPalette({
  services,
  brush,
  onPick,
  onClose,
}: {
  services: Service[];
  brush: Brush | null;
  onPick: (b: Brush | null) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(brush?.serviceId ?? services[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("16:00");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const service = services.find((s) => s.id === serviceId) ?? null;
  const templates = service?.templates ?? [];

  function selectService(id: string) {
    setServiceId(id);
    onPick(null); // al cambiar de servicio, se deselecciona el turno
    setError(null);
  }

  function pickTemplate(t: ShiftTemplate) {
    if (!service) return;
    onPick({ serviceId: service.id, serviceName: service.name, color: service.color, template: t });
  }

  function addTemplate() {
    if (!service) return;
    setError(null);
    if (!newCode.trim()) {
      setError("Pon un código al turno (ej: T)");
      return;
    }
    startTransition(async () => {
      try {
        await addTemplateToService(service.id, { code: newCode, start: newStart, end: newEnd });
        setNewCode("");
        setAdding(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo añadir el turno");
      }
    });
  }

  return (
    <div className="animate-pop card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          <span className="mr-1 inline-block rounded bg-[var(--primary)] px-1.5 py-0.5 text-xs font-bold text-white">1</span>
          Servicio
        </p>
        <button onClick={onClose} className="btn btn-outline px-3 py-1 text-xs">
          <X size={14} /> Salir del modo pintar
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {services.map((s) => {
          const active = s.id === serviceId;
          return (
            <button
              key={s.id}
              onClick={() => selectService(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm",
                "transition-all duration-150 active:scale-95",
                active
                  ? "text-white shadow-md"
                  : "bg-white hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700",
              )}
              style={
                active
                  ? { background: s.color, borderColor: s.color }
                  : { borderColor: "var(--border)" }
              }
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: active ? "#fff" : s.color }}
              />
              {s.name}
            </button>
          );
        })}
      </div>

      {service && (
        <>
          <p className="mb-2 text-sm font-medium">
            <span className="mr-1 inline-block rounded bg-[var(--primary)] px-1.5 py-0.5 text-xs font-bold text-white">2</span>
            Turno de {service.name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {templates.length === 0 && !adding && (
              <p className="text-sm text-[var(--muted)]">
                Este servicio aún no tiene turnos definidos — añade el primero:
              </p>
            )}
            {templates.map((t) => {
              const active = brush?.template.id === t.id && brush?.serviceId === service.id;
              return (
                <button
                  key={t.id}
                  onClick={() => pickTemplate(t)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-sm font-medium",
                    "transition-all duration-150 active:scale-95",
                    active
                      ? "text-white shadow-md"
                      : "bg-white hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700",
                  )}
                  style={
                    active
                      ? { background: service.color, borderColor: service.color }
                      : { borderColor: service.color, color: service.color }
                  }
                >
                  <span className="font-bold">{t.code}</span> {t.start}–{t.end}
                </button>
              );
            })}

            {adding ? (
              <span className="flex items-center gap-1.5">
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="input w-14 px-2 text-center font-semibold"
                  placeholder="T"
                  maxLength={4}
                  autoFocus
                />
                <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="input w-auto px-2" />
                <span className="text-[var(--muted)]">–</span>
                <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="input w-auto px-2" />
                <button onClick={addTemplate} disabled={isPending} className="btn btn-primary px-3 py-1.5 text-xs">
                  {isPending ? "…" : "Añadir"}
                </button>
                <button onClick={() => { setAdding(false); setError(null); }} className="btn btn-outline px-3 py-1.5 text-xs">
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="rounded-lg border border-dashed px-3 py-1.5 text-sm text-[var(--muted)] transition hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ borderColor: "var(--border)" }}
              >
                + Nuevo turno
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
          <p className="mt-3 text-xs text-[var(--muted)]">
            Si el fin es anterior al inicio (ej. 22:00–07:30) el turno termina al día siguiente.
          </p>
        </>
      )}
    </div>
  );
}
