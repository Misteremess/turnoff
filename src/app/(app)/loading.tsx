import { Loader2 } from "lucide-react";

// Suspense fallback para toda la sección autenticada: sin este archivo,
// Next.js espera a que el servidor termine de cargar los datos de la
// página antes de cambiar de pantalla, dando sensación de lentitud al
// pulsar los botones del menú.
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Loader2 className="animate-spin text-[var(--primary)]" size={32} />
    </div>
  );
}
