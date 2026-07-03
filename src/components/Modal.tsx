"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Bloquea el scroll del fondo mientras el modal está abierto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Portal al <body>: así el modal siempre cubre y se centra en TODA la
  // pantalla, aunque un ancestro tenga transform/animaciones.
  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)] backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <div
        className="modal-panel card max-h-[92dvh] w-full overflow-y-auto rounded-b-none rounded-t-3xl p-5 sm:my-8 sm:max-w-lg sm:rounded-2xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Asa visual en móvil (estilo bottom-sheet) */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden dark:bg-slate-700" />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--muted)] transition-colors hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
