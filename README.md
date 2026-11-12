# Plataforma institucional Colima 2027

Panel web para administrar usuarios institucionales y consultar los registros de validación reportados por una aplicación Android. Está construido con Next.js 16, React 19, TypeScript y Firebase Authentication con Realtime Database. La aplicación se exporta como sitio estático a `out/` y puede servirse con Firebase Hosting; no requiere un servidor de aplicación propio.

## Funciones

- Inicio de sesión con correo y contraseña.
- Panel de actividad, consulta de validaciones y detalle de cada registro.
- Reportes filtrables, resúmenes agrupados y exportación CSV.
- Administración de usuarios, roles y estado de acceso.
- Bitácora de actividad administrativa y configuración del nombre institucional.
- Acceso a funciones según el rol asignado.

Los datos de validación son reportados por la aplicación móvil; el panel no los presenta como una verificación criptográfica independiente. Las consultas de validaciones están limitadas a 500 registros y el directorio de usuarios a 200 por consulta.

## Requisitos

- Node.js compatible con Next.js 16 y npm.
- Para desarrollo local con Firebase: Firebase CLI y los emuladores de Authentication, Realtime Database y Hosting.

## Desarrollo local

Instala las dependencias y crea la configuración local:

```sh
npm ci
cp .env.example .env.local
```

Para trabajar con los emuladores, configura `NEXT_PUBLIC_USE_EMULATORS=true` en `.env.local`. No se requieren credenciales reales: el cliente usa el proyecto local `demo-colima-2027` y se conecta únicamente a `localhost` o `127.0.0.1`.

Inicia los emuladores en una terminal:

```sh
npm run emulators
```

En otra terminal, inicia Next.js:

```sh
npm run dev
```

Abre `http://localhost:3000`. La raíz redirige al panel; el acceso está en `/login`. Crea las cuentas de prueba desde la interfaz de Firebase Authentication Emulator. El repositorio no incluye usuarios, contraseñas ni datos de demostración predefinidos.

Para conectar un proyecto Firebase real, deja `NEXT_PUBLIC_USE_EMULATORS=false` y completa en `.env.local` las variables `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_DATABASE_URL`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` y `NEXT_PUBLIC_FIREBASE_APP_ID`. La URL debe ser la de Realtime Database, no la de Cloud Storage. Configura Authentication y publica las reglas de `database.rules.json` antes de usar datos reales.

## Comandos

```sh
npm run dev              # Servidor de desarrollo
npm run build            # Genera la exportación estática en out/
npm run start            # Sirve out/ localmente en el puerto 3000
npm run typecheck        # Verifica TypeScript
npm run lint             # Ejecuta ESLint
npm test                 # Pruebas unitarias y de componentes
npm run test:rules       # Pruebas de reglas con el emulador de Database
npm run test:integration # Pruebas de integración con Auth y Database
```

Las pruebas de reglas e integración inician sus propios emuladores; detén antes cualquier instancia iniciada con `npm run emulators`. La exportación de producción se genera en `out/`, que puede publicarse con Firebase Hosting.

## Estructura

```text
src/app/        Rutas de la aplicación
src/components/ Pantallas y componentes de interfaz
src/hooks/      Autenticación y acceso a datos
src/lib/        Firebase, esquemas y utilidades
src/services/   Operaciones de usuarios y configuración
src/types/      Tipos de dominio
tests/          Pruebas unitarias, de reglas e integración
public/         Recursos estáticos y tipografías
```

## Archivos locales

`.gitignore` excluye dependencias (`node_modules/`), builds (`.next/`, `out/`), variables locales (`.env*`, excepto `.env.example`), datos de emuladores (`.firebase/`), logs, cobertura y resultados generados. También excluye `docs/`, `.playwright-cli/` y el contenido de `output/`; por tanto, esos archivos locales no forman parte del código fuente versionado ni están disponibles necesariamente al clonar el repositorio.
