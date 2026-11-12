# Plataforma institucional Colima 2027

Panel administrativo para gestionar perfiles institucionales y consultar las validaciones registradas por las aplicaciones Android. Usa Next.js 16, Supabase Auth, PostgreSQL, RLS y Supabase Realtime. Se ejecuta como servidor Next.js dentro del LXC y se publica mediante el Cloudflare Tunnel existente.

Las aplicaciones Android escriben lecturas en `public.validations` mediante la API REST de Supabase. El contrato está en [docs/android-integration.md](docs/android-integration.md). Las lecturas son resultados reportados por la app; el panel no realiza ni certifica las verificaciones del documento.

## Funciones

- Inicio y recuperación de contraseña con Supabase Auth.
- Autorización de perfiles y roles mediante políticas RLS.
- Administración de usuarios, roles y estado institucional.
- Consultas en tiempo real de validaciones, perfiles, auditoría y configuración.
- Dashboard, filtros, reportes y exportación CSV.
- Bitácora administrativa de cambios realizados desde el panel.

Las consultas del panel están limitadas a 500 validaciones, 500 registros de auditoría y 200 perfiles por lectura. La interfaz indica cuando alcanzó esos límites.

## Desarrollo local

Requiere Node.js 22 o superior, npm y Docker para el stack local de Supabase.

```sh
npm ci
cp .env.example .env.local
```

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`. La clave publishable es pública; nunca añadas una secret key o service-role key al navegador.

Para iniciar el stack local de Supabase:

```sh
npm run supabase:start
```

Después de completar la configuración local y aplicar las migraciones, inicia la aplicación:

```sh
npm run dev
```

El panel queda disponible en `http://localhost:3000`. Las migraciones viven en `supabase/migrations/`; `npm run supabase:test` ejecuta las pruebas SQL locales.

## Comandos

```sh
npm run dev                 # Next.js de desarrollo
npm run build               # Build de producción de Next.js
npm start                   # Servidor Next.js en 127.0.0.1:3000
npm run typecheck           # Verificación de TypeScript
npm run lint                # ESLint
npm test                    # Pruebas unitarias y de componentes
npm run test:android-contract # Contrato REST usado por Android
npm run supabase:start      # Supabase local (requiere Docker)
npm run supabase:test       # Pruebas SQL con Supabase local
npm run supabase:stop       # Detener Supabase local
```

## Despliegue en el LXC

`npm run build` genera `.next/`; `npm start` ejecuta el servidor en `127.0.0.1:3000`. Configura Cloudflare Tunnel para alcanzar ese puerto, directamente o mediante el proxy inverso existente. Define las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` antes de compilar.

En Supabase Auth, configura el dominio público del panel como URL del sitio y como URL permitida para enlaces de confirmación y recuperación. La sesión de la aplicación utiliza el perfil activo de `public.profiles`; una cuenta Auth sin ese perfil no puede consultar datos.

## Estructura

```text
src/app/        Rutas del panel
src/components/ Pantallas y componentes
src/hooks/      Autenticación y suscripciones
src/lib/        Cliente Supabase, validadores y utilidades
src/services/   Operaciones de perfiles y configuración
src/types/      Modelos de la aplicación y tipos SQL
supabase/       Configuración y migraciones PostgreSQL
tests/          Pruebas unitarias y de componentes
```

`.gitignore` excluye dependencias, builds, variables locales y datos temporales de Supabase. El `.env` nunca debe incluirse en commits.
