# Plataforma institucional Colima 2027

Panel administrativo en Next.js estático para perfiles institucionales y resultados reportados por aplicaciones Android. Firebase Spark: Authentication correo/contraseña, Realtime Database y Hosting tradicional. Sin servidor de aplicación ni servicios de pago.

## Inicio

```sh
npm ci
npm run emulators
```

En otra terminal, crear `.env.local` con `NEXT_PUBLIC_USE_EMULATORS=true` y ejecutar `npm run dev`. En modo emulador la configuración fuerza el proyecto `demo-colima-2027` y sólo admite hosts locales. Crear el primer perfil de prueba desde la UI del emulador siguiendo [despliegue](docs/deployment.md). No se incluyen cuentas, contraseñas administrativas ni datos de demostración predeterminados.

Para un proyecto real, copiar `.env.example` a `.env.local`, completar la configuración pública y dejar emuladores en false. Publicar reglas antes de conectar clientes.

## Comprobaciones

```sh
npm run typecheck
npm run lint
npm test
npm run test:rules
npm run test:integration
npm run build
```

Detener emuladores interactivos antes de ejecutar las pruebas que levantan su propia instancia. Las pruebas usan exclusivamente proyecto demo local. `out/` es el resultado publicable, con todas las rutas estáticas. El build sin configuración muestra un aviso de conexión pendiente y bloquea el acceso; no inventa datos.

## Documentos

- [Arquitectura y límites de consultas](docs/architecture.md)
- [Reglas y confianza](docs/security.md)
- [Contrato de eventos Android: JSON, Java y Kotlin](docs/android-integration.md)
- [Cuotas y restricciones Spark](docs/firebase-spark.md)
- [Primer administrador y despliegue](docs/deployment.md)
- [Plan de implementación](docs/implementation-plan.md)
- [Identidad y recursos oficiales](docs/brand.md)
- [Skills revisadas](docs/skills.md)
- [Verificación y pendientes](docs/verification.md)

Las exportaciones incluyen como máximo la ventana autorizada de 500 lecturas y los filtros visibles. La lista de perfiles está limitada a 200. Los resultados enviados por Android no son una verificación criptográfica independiente. La revocación del perfil restringe RTDB; deshabilitar cuentas Auth requiere intervención privilegiada.
