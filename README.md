# InsiDesk — Sistema de Tickets con integración Remotely

Sistema de gestión de tickets de soporte técnico multi-tenant (por empresa), con control remoto
de equipos vía [Remotely](https://github.com/immense/Remotely). Backend en Express + **Prisma** +
PostgreSQL + Redis, frontend en React + Vite + Tailwind.

## Arquitectura

El backend se organiza por **features auto-contenidas** (screaming architecture), con Prisma como
única fuente de verdad del esquema:

```
backend/
  prisma/
    schema.prisma  → modelos, enums y relaciones (fuente de verdad)
    seed.ts        → datos de prueba (empresa + admin/tecnico/cliente + device + ticket)
    migrations/    → generadas por `prisma migrate dev`, no se editan a mano
  src/
    features/
      auth/          → registro, login, refresh de tokens
      users/         → administración de usuarios
      tickets/       → tickets y notas
      devices/       → inventario de dispositivos
      remotely/      → integración con el servidor Remotely
      notifications/ → envío de notificaciones (email / in-app) vía colas
    shared/
      prisma/        → client singleton + middleware (encryption, audit, RBAC)
      cache/         → CacheService sobre Redis, cache-keys
      events/        → event emitter con pub/sub sobre Redis
      queue/         → QueueService (Bull) para trabajos en background
      security/      → rate limiter (Redis-backed)
      monitoring/    → métricas Prometheus + alerta simple de logins fallidos
      backup/        → backup programado con pg_dump (opt-in)
      services/      → orquestación entre features (ver nota abajo)
      auth/, middleware/, utils/, types/  → transversal, sin lógica de negocio
    config/          → env, conexión a Redis, punto de extensión para un vault real
```

> `shared/services/device-status-updater.service.ts` es la única excepción a la regla "shared no
> tiene lógica de negocio": orquesta `remotely` + `devices` sin que ninguna dependa de la otra.

Cada feature expone su API pública en `features/<x>/index.ts`; otras features solo importan desde
ahí (`import { X } from '../otraFeature'`), nunca desde sus archivos internos.

## Modelo de datos (multi-tenant)

Cada `Company` (empresa) tiene sus propios `User`, `Device` y `Ticket`. El middleware RBAC de
Prisma (`shared/prisma/middleware/rbac.middleware.ts`) filtra automáticamente las lecturas de
`cliente`/`tecnico` por su `empresaId` — `admin` ve todas las empresas. Los `create` **no** pasan
por ese middleware (Prisma solo lo aplica a lecturas), así que los controllers de tickets/devices
fuerzan `empresaId = req.user.empresaId` para cualquiera que no sea admin, incluso si el body trae
otro valor.

Otros mecanismos de seguridad activos:
- **Encriptación en reposo** (AES-256-GCM) de `Device.ipLocal` / `ipPublica`, encriptado/desencriptado
  de forma transparente por middleware de Prisma — incluso cuando el `Device` viene anidado dentro
  de un `Ticket` (`include: { dispositivo: true }}`).
- **Audit log** automático (`audit_log`) en cada `create`/`update`/`delete`, con el usuario/IP/user-agent
  tomados de un `AsyncLocalStorage` (`shared/utils/context.ts`) que llena `verifyJWT`.
- **FailedLoginAttempt**: cada intento de login inválido queda registrado (email, IP, razón).
- Los relaciones a `User` (autor de una nota, reporter/asignado de un ticket, etc.) siempre se
  incluyen con `select: safeUserSelect` (`shared/prisma/safe-select.ts`) — nunca `include: true` —
  para que el `passwordHash` no viaje en ninguna respuesta HTTP.

## Requisitos

- Node.js 20+
- Docker (para Postgres 15 + Redis 7) o instancias propias
- Una instancia de [Remotely](https://github.com/immense/Remotely) accesible (opcional para probar
  auth/tickets/devices; sin ella, el poller de estado solo logueará errores de conexión cada 5s)

## Setup

### 1. Variables de entorno

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Edita `backend/.env`:
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: `openssl rand -hex 32`
- `ENCRYPTION_KEY`: **debe ser hex de 64 caracteres exactos** (32 bytes) — `openssl rand -hex 32`.
  Sin esto, cualquier operación sobre `Device` (que toque `ipLocal`/`ipPublica`) lanza error.
- `REDIS_PASSWORD`, `REMOTELY_SERVER_URL` / `REMOTELY_API_KEY` si tienes una instancia real
- El resto de `DB_*` / `CACHE_*` / `QUEUE_*` / `BACKUP_*` tienen defaults razonables para dev

### 2. Levantar Postgres y Redis

```bash
docker compose up -d postgres redis   # requiere el .env de la raíz, ver "Despliegue con Docker / Portainer"
```

## Despliegue con Docker / Portainer

El stack (`docker-compose.yml`) son 3 contenedores: `postgres`, `redis` y `app`
(**backend + frontend en un solo contenedor**: Node corre la API y nginx sirve el
frontend y hace de proxy de `/api` y `/socket.io`, todo bajo el mismo origen).

El código **no se copia a ninguna imagen**: la carpeta del proyecto se monta en
`/app` (`PROJECT_DIR`) y `docker/entrypoint.sh` instala dependencias, compila y
sirve al iniciar. Las dependencias y el build viven en volúmenes nombrados, y se
recalculan solo si cambia el código (un reinicio sin cambios arranca en segundos).

```bash
cp .env.stack.example .env      # completar PROJECT_DIR (ruta absoluta), secretos, URL pública
docker compose up -d --build    # la imagen es genérica (solo Node + nginx + pg_dump)
```

- **Actualizar**: `git pull` en el host + `docker compose restart app`.
- **Portainer**: Stacks → Add stack → pegar `docker-compose.yml` (o apuntar al repo) y
  cargar las variables de `.env.stack.example` en *Environment variables*. `PROJECT_DIR`
  debe ser la ruta absoluta del proyecto en el servidor.
- **Datos**: volúmenes `insidesk_postgres_data`, `insidesk_redis_data`, `insidesk_backend_uploads`,
  `insidesk_backend_backups` (pg_dump diario, retención `BACKUP_RETENTION_DAYS`) y `insidesk_backend_logs`.
- **Restaurar un backup**: `docker exec tickets_app sh /app/backend/scripts/restore-backup.sh /data/backups/backup-XXXX.sql <DATABASE_URL_destino>`.
- **HTTPS**: poner un proxy con TLS delante (Traefik/Caddy/NPM) → `COOKIE_SECURE=true` y `TRUST_PROXY=2`.

### 3. Instalar dependencias y generar el cliente de Prisma

```bash
cd backend
npm install
npm run prisma:generate
```

### 4. Migrar y sembrar datos de prueba

```bash
npm run prisma:migrate   # crea las tablas (prompt de nombre solo la primera vez; usa --name si es CI)
npm run prisma:seed      # empresa + admin/tecnico/cliente + un device + un ticket
```

Credenciales de prueba creadas por el seed (todas en la misma empresa "Mi Empresa Prueba"):

| Rol      | Email                | Password       |
|----------|-----------------------|----------------|
| admin    | admin@empresa.com     | `Admin123!@#`   |
| tecnico  | tecnico@empresa.com   | `Tech123!@#`    |
| cliente  | cliente@empresa.com   | `Cliente123!@#` |

### 5. Ejecutar en desarrollo

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

### 6. Acceder

- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- Health: http://localhost:3000/health · http://localhost:3000/health/db
- Métricas Prometheus: http://localhost:3000/metrics
- Prisma Studio (explorar la BD visualmente): `npm run prisma:studio` (dentro de `backend/`)

### Probar login por curl

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","password":"Admin123!@#"}'
```

Copia el `accessToken` de la respuesta y úsalo en el resto de llamadas:
`curl http://localhost:3000/api/tickets -H "Authorization: Bearer <accessToken>"`

## Mapa de rutas API

Todas las rutas salvo `/api/auth/*`, `/health` y `/metrics` requieren `Authorization: Bearer <accessToken>`.

```
POST   /api/auth/register              Registrar usuario (siempre rol cliente)
POST   /api/auth/login                 Login
POST   /api/auth/refresh               Renovar token

GET    /api/tickets                    Listar tickets (?empresaId, estado, prioridad, usuarioAsignadoId)
POST   /api/tickets                    Crear ticket
GET    /api/tickets/:id                Detalle ticket
PUT    /api/tickets/:id                Editar ticket
PATCH  /api/tickets/:id/estado         Cambiar estado (abierto|en_progreso|en_espera|cerrado|cancelado)
DELETE /api/tickets/:id                Eliminar

POST   /api/tickets/:id/notes          Agregar nota
GET    /api/tickets/:id/notes          Listar notas
DELETE /api/tickets/:id/notes/:noteId  Eliminar nota

GET    /api/devices                    Listar dispositivos (?empresaId, estado)
POST   /api/devices                    Crear dispositivo
GET    /api/devices/:id                Detalle
GET    /api/devices/:id/status         Estado en vivo (cache Redis, TTL 60s; fallback a BD)
PUT    /api/devices/:id                Editar
DELETE /api/devices/:id                Eliminar

POST   /api/remotely/connect/:id       Iniciar sesión remota (guarda RemotelySession local)
GET    /api/remotely/devices           Listar dispositivos de Remotely
POST   /api/remotely/execute-script    Ejecutar script en un dispositivo
GET    /api/remotely/sessions/:id      Historial de sesiones (desde la BD local, no desde Remotely)

POST   /api/notifications/test         Encolar una notificación de prueba (email o in_app)
GET    /api/notifications/jobs/:jobId  Estado de un job de notificación (?channel=email|in_app)

GET    /api/users                      Listar usuarios (solo admin)
PUT    /api/users/:id                  Editar usuario (solo admin)
DELETE /api/users/:id                  Eliminar usuario (solo admin)
```

## Redis: cache, pub/sub y colas

- **Cache** (`shared/cache/`): `TicketService`/`DeviceService` cachean listas por
  `empresaId + hash de filtros` (nunca por lo que mande el cliente sin validar — ver la nota de
  seguridad en `ticket.service.ts` sobre por qué la key se resuelve contra el usuario autenticado).
  Los ítems individuales (`getById`) **no se cachean**, a propósito: como pasan por el middleware
  RBAC en cada lectura, cachearlos por id rompería el aislamiento multi-tenant en el próximo hit.
- **Pub/sub** (`shared/events/event.emitter.ts`, sobre `ioredis`): eventos `ticket.created`,
  `ticket.updated`, `ticket.status.changed`, `device.status.changed`. `notifications` se suscribe
  sin importar nada de `tickets`/`devices`.
- **Colas** (`shared/queue/queue.service.ts`, sobre Bull): `notifications-email` y
  `notifications-push`, con reintentos exponenciales. Los jobs (`features/notifications/jobs/`) son
  placeholders que solo loguean — conectar un proveedor real (SMTP, FCM, etc.) antes de producción.
- **Estado de dispositivos en vivo**: `shared/services/device-status-updater.service.ts` sondea
  Remotely cada 5s y cachea `device:{id}:status` (TTL 60s); emite `device.status.changed` si cambia.

## Notas sobre piezas "de infraestructura" con alcance reducido

El pedido de migración a Prisma mencionaba `vaultService`, `monitoringService` y `backupService`
sin especificarlos — se implementaron versiones honestas y mínimas, no integraciones completas:

- **`config/vault.ts`**: no conecta a ningún vault real; es el punto de extensión para cuando se
  configure HashiCorp Vault / AWS Secrets Manager. Hoy los secretos siguen viniendo de `.env`.
- **`shared/monitoring/monitoring.service.ts`**: expone métricas Prometheus (`/metrics`) y una
  alerta por log (no por Slack/PagerDuty) si hay ≥10 logins fallidos en 5 minutos.
- **`shared/backup/backup.service.ts`**: deshabilitado por defecto (`BACKUP_ENABLED=false`) porque
  requiere `pg_dump` en el `PATH`, que la mayoría de entornos de desarrollo no tienen instalado.

## Scripts útiles (dentro de `backend/`)

| Comando                     | Descripción                                          |
|------------------------------|-------------------------------------------------------|
| `npm run dev`                 | Servidor de desarrollo (tsx watch)                    |
| `npm run build` / `start`     | Build de producción y arranque                        |
| `npm run typecheck`           | Chequeo de tipos                                       |
| `npm run prisma:generate`     | Regenerar el cliente de Prisma tras editar el schema  |
| `npm run prisma:migrate`      | Crear y aplicar una migración en dev                  |
| `npm run prisma:migrate:deploy` | Aplicar migraciones existentes (CI/producción)      |
| `npm run prisma:studio`       | UI para explorar/editar la BD                         |
| `npm run prisma:seed`         | Re-sembrar datos de prueba                            |

## Próximos pasos sugeridos

1. Ajustar los paths de `RemotelyService` a la versión exacta de tu servidor Remotely
2. Conectar un proveedor real de email/push en `features/notifications/jobs/`
3. Añadir tests de integración, sobre todo para el aislamiento multi-tenant (RBAC middleware)
4. Configurar CI (lint + typecheck + `prisma migrate deploy` + test) antes de desplegar
5. Reemplazar `config/vault.ts` por una integración real si el proyecto lo requiere
