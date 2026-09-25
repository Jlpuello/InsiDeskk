-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'tecnico', 'cliente');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('abierto', 'en_progreso', 'en_espera', 'cerrado', 'cancelado');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('baja', 'media', 'alta', 'critica');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('online', 'offline', 'inactivo');

-- CreateEnum
CREATE TYPE "OperatingSystem" AS ENUM ('Windows', 'Linux', 'MacOS');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('interna', 'cliente', 'sistema');

-- CreateEnum
CREATE TYPE "CompanyPlan" AS ENUM ('basico', 'profesional', 'enterprise');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email_contacto" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "pais" TEXT,
    "plan" "CompanyPlan" NOT NULL DEFAULT 'basico',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "rol" "UserRole" NOT NULL DEFAULT 'cliente',
    "empresa_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hostname" TEXT,
    "ip_local" TEXT,
    "ip_public" TEXT,
    "empresa_id" TEXT NOT NULL,
    "remotely_id" TEXT,
    "so" "OperatingSystem",
    "version_so" TEXT,
    "cpuCores" INTEGER,
    "ramGb" INTEGER,
    "discoGb" INTEGER,
    "ultimo_contacto" TIMESTAMP(3),
    "estado" "DeviceStatus" NOT NULL DEFAULT 'offline',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "TicketStatus" NOT NULL DEFAULT 'abierto',
    "prioridad" "TicketPriority" NOT NULL DEFAULT 'media',
    "empresa_id" TEXT NOT NULL,
    "usuario_reporter_id" TEXT NOT NULL,
    "usuario_asignado_id" TEXT,
    "dispositivo_id" TEXT,
    "tiempo_estimado" INTEGER,
    "tiempo_real" INTEGER,
    "resuelto_por" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "tipo" "NoteType" NOT NULL DEFAULT 'interna',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "campo_modificado" TEXT NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT,
    "usuario_id" TEXT NOT NULL,
    "razon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remotely_sessions" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "dispositivo_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "remotely_session_id" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin" TIMESTAMP(3),
    "duracion_minutos" INTEGER,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remotely_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remotely_scripts_execution" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "dispositivo_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "script_id" TEXT NOT NULL,
    "script_nombre" TEXT,
    "estado" TEXT NOT NULL,
    "exit_code" INTEGER,
    "output" TEXT,
    "error_mensaje" TEXT,
    "duracion_segundos" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "remotely_scripts_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "accion" TEXT NOT NULL,
    "tabla" TEXT NOT NULL,
    "registro_id" TEXT,
    "cambios_anteriores" JSONB,
    "cambios_nuevos" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "resultado" TEXT NOT NULL,
    "error_mensaje" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "razon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_nombre_key" ON "companies"("nombre");

-- CreateIndex
CREATE INDEX "companies_activo_idx" ON "companies"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_empresa_id_idx" ON "users"("empresa_id");

-- CreateIndex
CREATE INDEX "users_rol_idx" ON "users"("rol");

-- CreateIndex
CREATE INDEX "users_activo_idx" ON "users"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "devices_hostname_key" ON "devices"("hostname");

-- CreateIndex
CREATE INDEX "devices_empresa_id_idx" ON "devices"("empresa_id");

-- CreateIndex
CREATE INDEX "devices_estado_idx" ON "devices"("estado");

-- CreateIndex
CREATE INDEX "devices_remotely_id_idx" ON "devices"("remotely_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_empresa_id_hostname_key" ON "devices"("empresa_id", "hostname");

-- CreateIndex
CREATE INDEX "tickets_empresa_id_idx" ON "tickets"("empresa_id");

-- CreateIndex
CREATE INDEX "tickets_estado_idx" ON "tickets"("estado");

-- CreateIndex
CREATE INDEX "tickets_prioridad_idx" ON "tickets"("prioridad");

-- CreateIndex
CREATE INDEX "tickets_usuario_asignado_id_idx" ON "tickets"("usuario_asignado_id");

-- CreateIndex
CREATE INDEX "tickets_usuario_reporter_id_idx" ON "tickets"("usuario_reporter_id");

-- CreateIndex
CREATE INDEX "tickets_dispositivo_id_idx" ON "tickets"("dispositivo_id");

-- CreateIndex
CREATE INDEX "tickets_createdAt_idx" ON "tickets"("createdAt");

-- CreateIndex
CREATE INDEX "notes_ticket_id_idx" ON "notes"("ticket_id");

-- CreateIndex
CREATE INDEX "notes_usuario_id_idx" ON "notes"("usuario_id");

-- CreateIndex
CREATE INDEX "ticket_history_ticket_id_idx" ON "ticket_history"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_history_usuario_id_idx" ON "ticket_history"("usuario_id");

-- CreateIndex
CREATE INDEX "ticket_history_createdAt_idx" ON "ticket_history"("createdAt");

-- CreateIndex
CREATE INDEX "remotely_sessions_ticket_id_idx" ON "remotely_sessions"("ticket_id");

-- CreateIndex
CREATE INDEX "remotely_sessions_dispositivo_id_idx" ON "remotely_sessions"("dispositivo_id");

-- CreateIndex
CREATE INDEX "remotely_sessions_usuario_id_idx" ON "remotely_sessions"("usuario_id");

-- CreateIndex
CREATE INDEX "remotely_sessions_fecha_inicio_idx" ON "remotely_sessions"("fecha_inicio");

-- CreateIndex
CREATE INDEX "remotely_scripts_execution_dispositivo_id_idx" ON "remotely_scripts_execution"("dispositivo_id");

-- CreateIndex
CREATE INDEX "remotely_scripts_execution_usuario_id_idx" ON "remotely_scripts_execution"("usuario_id");

-- CreateIndex
CREATE INDEX "remotely_scripts_execution_createdAt_idx" ON "remotely_scripts_execution"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_idx" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "audit_log_tabla_idx" ON "audit_log"("tabla");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "failed_login_attempts_email_idx" ON "failed_login_attempts"("email");

-- CreateIndex
CREATE INDEX "failed_login_attempts_ip_address_idx" ON "failed_login_attempts"("ip_address");

-- CreateIndex
CREATE INDEX "failed_login_attempts_createdAt_idx" ON "failed_login_attempts"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_usuario_reporter_id_fkey" FOREIGN KEY ("usuario_reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_usuario_asignado_id_fkey" FOREIGN KEY ("usuario_asignado_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_resuelto_por_fkey" FOREIGN KEY ("resuelto_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remotely_sessions" ADD CONSTRAINT "remotely_sessions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remotely_sessions" ADD CONSTRAINT "remotely_sessions_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remotely_sessions" ADD CONSTRAINT "remotely_sessions_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remotely_scripts_execution" ADD CONSTRAINT "remotely_scripts_execution_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remotely_scripts_execution" ADD CONSTRAINT "remotely_scripts_execution_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
