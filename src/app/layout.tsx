import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TurnOff — Gestión de turnos",
  description: "Gestiona tus turnos de vigilancia, horas y sueldo en un solo sitio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} h-full antialiased`}
      // El script de abajo añade data-theme antes de hidratar (para no dar
      // un flash con el tema por defecto), a propósito distinto de lo que
      // el servidor renderizó — sin esto React lo marca como mismatch.
      suppressHydrationWarning
    >
      <body className="min-h-full">
        {/* Aplica el tema guardado antes de pintar, para no dar un flash
            con el tema por defecto y luego saltar al elegido por el usuario. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t&&t!=='system'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();",
          }}
        />
        {children}
      </body>
    </html>
  );
}
