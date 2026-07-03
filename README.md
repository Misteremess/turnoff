# TurnOff — Gestión de turnos para vigilantes

App web personal para gestionar turnos en distintos servicios, con:

- 📅 **Calendario completo** (mes / semana / día) con arrastrar y soltar.
- 🗂️ **Mini-CRM de servicios**: tarifas base, nocturnidad, festivo y extra, contacto.
- ⏱️ **Control de horas y sueldo estimado** con informes mensuales exportables a PDF/Excel.
- 🔄 **Sincronización automática con Google Calendar** en dos vías (sin botones).
- 🌗 **Tema claro/oscuro** automático según el sistema.
- 🔐 **Login con Google**, sesión persistente en el dispositivo.

Stack: **Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase · FullCalendar**.

---

## 1. Requisitos

- Node.js 20+.
- Una cuenta de [Supabase](https://supabase.com) (gratis).
- Un proyecto en [Google Cloud](https://console.cloud.google.com) (solo si quieres la sync con Google Calendar).

## 2. Configurar Supabase

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, pega y ejecuta el contenido de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Esto crea las tablas `services`, `shifts`, `sync_state` y activa RLS.
3. En **Project Settings → API** copia la `Project URL` y la `anon public key`.

## 3. Configurar el login con Google

1. En **Google Cloud Console**:
   - Habilita la **Google Calendar API**.
   - Configura la **pantalla de consentimiento OAuth** (tipo *Externo*; añade tu
     correo como usuario de prueba).
   - Crea unas credenciales **ID de cliente de OAuth** (tipo *Aplicación web*).
     - En *Orígenes autorizados de JavaScript*: `http://localhost:3000`.
     - En *URI de redirección autorizados* añade el callback de Supabase:
       `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`.
   - Copia el **Client ID** y el **Client secret**.
2. En **Supabase → Authentication → Providers → Google**:
   - Actívalo y pega el Client ID y Client secret.
   - En **Additional Scopes** añade: `https://www.googleapis.com/auth/calendar`.
3. En **Supabase → Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:3000`.
   - *Redirect URLs*: añade `http://localhost:3000/auth/callback`.

## 4. Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CRON_SECRET=...
NEXT_PUBLIC_BASE_PATH=
```

> `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` solo son necesarios para la
> sincronización con Google Calendar. La app funciona sin ellos (login incluido);
> simplemente no habrá nada que sincronizar.
>
> `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` solo hacen falta para el *pull*
> automático en segundo plano (ver [sección 7](#6-sincronización-automática)).
> `NEXT_PUBLIC_BASE_PATH` solo hace falta si despliegas bajo un subdirectorio
> (ver [Despliegue](#despliegue)); en local déjalo vacío.

## 5. Arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), inicia sesión con Google,
crea un servicio y empieza a añadir turnos.

---

## 6. Sincronización automática

La sincronización es bidireccional y **no requiere ninguna acción manual**:

- **App → Google** (instantánea): al crear, mover o borrar un turno se manda
  el cambio a Google Calendar en segundo plano (`after()`), sin bloquear la
  respuesta al usuario.
- **Google → App** (pull incremental, usando `syncToken` para traer solo lo
  que cambió):
  - **Mientras la app está abierta**: [`AutoSync`](src/components/calendar/AutoSync.tsx)
    la ejecuta al cargar, cada 3 minutos y al volver a la pestaña — sin botón,
    solo un indicador pasivo ("Sincronizado" / "Sincronizando…").
  - **Con la app cerrada**: el endpoint [`/api/cron/sync`](src/app/api/cron/sync/route.ts)
    recorre a todos los usuarios con la sync activada y hace el pull por ellos.
    No se llama solo: necesita un disparador externo (ver más abajo).

### Configurar el cron de sincronización en segundo plano

1. Rellena `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API →
   *service_role*, es secreta) y `CRON_SECRET` (cualquier cadena aleatoria,
   p. ej. `openssl rand -hex 24`) en las variables de entorno de producción.
2. En **Hostinger → hPanel → Avanzado → Cron Jobs**, crea una tarea cada
   10-15 minutos que ejecute:

   ```bash
   curl -fsS -H "Authorization: Bearer TU_CRON_SECRET" \
     https://www.maximoduperez.com/turnoff/api/cron/sync
   ```

   (Esta sección de hPanel está disponible en cualquier plan de Hostinger,
   compartido o VPS, así que funciona sea cual sea el tuyo.)

## Estructura

```
src/
  app/
    (app)/                # rutas protegidas (calendario, servicios, informes)
    api/cron/sync/        # pull en segundo plano (llamado por el cron externo)
    login/                # login con Google
    auth/callback/        # callback OAuth
  components/             # Nav, Modal, calendario (incl. AutoSync), etc.
  lib/
    supabase/             # clientes client/server/middleware/admin (service role)
    google/calendar.ts    # push/pull con Google Calendar
    payroll.ts            # cálculo de horas e importes
    types.ts
supabase/migrations/      # esquema SQL + RLS
```

## Despliegue

La app usa `proxy.ts` (middleware de auth), Server Actions y una Route Handler
de cron: necesita un **servidor Node.js corriendo**, no vale un export estático
ni el hosting compartido "solo PHP/HTML".

### Camino recomendado (gratis): Vercel + subdominio

El hosting de `maximoduperez.com` es Premium Web Hosting, que **no tiene
Node.js apps** (confirmado en hPanel → Hosting Plan). Subir a Business
Web Hosting daría Node.js, pero seguiría sin soportar un subdirectorio de un
dominio ya alojado ahí (hPanel obliga a borrar el sitio existente para crear
una app Node en el mismo dominio) — solo funcionaría como subdominio, y de
pago. Así que el camino gratis y más simple es exactamente ese: **Vercel para
la app + un subdominio apuntando a Vercel**, sin tocar ni pagar nada extra en
Hostinger. `turnoff.maximoduperez.com` en vez de `maximoduperez.com/turnoff`.

1. **Sube el código a GitHub** (si no lo está ya).
2. **Vercel** → [vercel.com/new](https://vercel.com/new) → importa el repo.
   No hace falta tocar `next.config.ts`: `NEXT_PUBLIC_BASE_PATH` se queda vacío
   (la app vive en la raíz del subdominio, no en un subdirectorio).
3. **Variables de entorno** en Vercel (Project Settings → Environment
   Variables) — las mismas que `.env.local`, sin `NEXT_PUBLIC_BASE_PATH`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   CRON_SECRET=...
   ```
4. **Dominio**: en Vercel → Project Settings → Domains, añade
   `turnoff.maximoduperez.com`. Vercel te da un registro CNAME (normalmente
   `cname.vercel-dns.com`).
5. **DNS en Hostinger**: hPanel → Domains → `maximoduperez.com` → DNS / Name
   Servers → añade un registro:
   ```
   Tipo: CNAME
   Nombre: turnoff
   Apunta a: cname.vercel-dns.com   (el valor exacto que te dé Vercel)
   ```
   Espera a que propague (minutos–horas) — Vercel emite el certificado SSL solo.

### Actualiza las URLs de redirect

Con la app ya en `turnoff.maximoduperez.com`, añade en:

- **Google Cloud Console** (credenciales OAuth) → *Orígenes autorizados de
  JavaScript*: `https://turnoff.maximoduperez.com`.
- **Supabase → Authentication → URL Configuration**:
  - *Site URL*: `https://turnoff.maximoduperez.com`.
  - *Redirect URLs*: `https://turnoff.maximoduperez.com/auth/callback`.

  (El *URI de redirección* en Google Cloud sigue siendo el callback de
  Supabase, `https://<TU-PROYECTO>.supabase.co/auth/v1/callback` — no cambia.)

### Cron de sincronización

Tu hosting actual (Premium) **sí incluye Cron Jobs** aunque no tenga Node.js —
es una función de hPanel independiente del tipo de sitio, y puede llamar a
cualquier URL externa. Así que el cron sigue montándose en Hostinger aunque la
app viva en Vercel:

hPanel → tu sitio → Avanzado → **Cron Jobs** → nueva tarea, cada 10-15 min,
tipo *Custom*, comando:

```bash
curl -fsS -H "Authorization: Bearer TU_CRON_SECRET" \
  https://turnoff.maximoduperez.com/api/cron/sync
```

Sin este cron job, el pull automático solo ocurre mientras la app está abierta
en el navegador (ver [sección 6](#6-sincronización-automática)).

### Si más adelante pasas a un VPS

Con un VPS sí se puede montar `maximoduperez.com/turnoff` como subdirectorio
real (Nginx como reverse proxy + PM2). `next.config.ts` ya lo soporta vía
`NEXT_PUBLIC_BASE_PATH=/turnoff`:

```bash
npm ci
NEXT_PUBLIC_BASE_PATH=/turnoff npm run build   # output: "standalone"
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
PORT=3001 pm2 start .next/standalone/server.js --name turnoff
pm2 save
```

Y en el `server {}` de Nginx del portfolio:

```nginx
location /turnoff/ {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Accel-Buffering no; # necesario para streaming (App Router)
}
```

En ese caso las URLs de redirect (Google Cloud, Supabase) y el cron usarían
`https://www.maximoduperez.com/turnoff` en vez del subdominio.
