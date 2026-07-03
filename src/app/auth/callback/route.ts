import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de OAuth: intercambia el `code` por una sesión y guarda el
 * refresh_token de Google (si viene) para poder sincronizar el calendario.
 */
// `origin` de new URL() nunca incluye el basePath (solo protocolo+host), así
// que hay que añadirlo a mano en los redirects para que apunten dentro del
// subdirectorio cuando la app está desplegada bajo uno (ver NEXT_PUBLIC_BASE_PATH).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}${basePath}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}${basePath}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Google solo devuelve el refresh_token la primera vez (o con prompt=consent).
  const refreshToken = data.session?.provider_refresh_token;
  const userId = data.user?.id;
  if (refreshToken && userId) {
    await supabase.from("sync_state").upsert(
      {
        user_id: userId,
        google_refresh_token: refreshToken,
        sync_enabled: true,
      },
      { onConflict: "user_id" },
    );
  }

  return NextResponse.redirect(`${origin}${basePath}${next}`);
}
