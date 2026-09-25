-- Migración generada retroactivamente: captura TODO el drift acumulado entre
-- la migración '20260915064006_initial' y el schema real (aplicado hasta ahora
-- vía 'prisma db push', sin generar migraciones intermedias). Se marca como ya
-- aplicada (prisma migrate resolve --applied) porque la base de datos de
-- desarrollo ya tiene esta estructura -- este archivo solo pone en blanco y
-- negro lo que 'migrate deploy' necesita para levantar una base nueva desde cero.

-- CreateEnum
CREATE TYPE "TicketCriticidad" AS ENUM ('baja', 'media', 'alta', 'critica');

-- CreateEnum
CREATE TYPE "ActividadTipo" AS ENUM ('integracion', 'mantenimiento', 'seguimiento', 'otro');

-- CreateEnum
CREATE TYPE "ActividadEstado" AS ENUM ('pendiente', 'en_progreso', 'completada', 'cancelada');

-- CreateEnum
CREATE TYPE "RecurrenciaTipo" AS ENUM ('diaria', 'semanal', 'mensual');

-- CreateEnum
CREATE TYPE "InventoryEquipmentType" AS ENUM ('router', 'switch', 'access_point', 'impresora', 'dvr', 'camara_ip', 'control_acceso');

-- CreateEnum
CREATE TYPE "InventoryEquipmentStatus" AS ENUM ('activo', 'en_reparacion', 'dado_de_baja');

-- CreateEnum
CREATE TYPE "QuoteEstado" AS ENUM ('borrador', 'pendiente_aprobacion', 'aprobado', 'rechazado', 'expirado');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('web', 'whatsapp');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('abierta', 'cerrada');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('contacto', 'staff');

-- CreateEnum
CREATE TYPE "TeamChannelType" AS ENUM ('dm', 'grupo');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NoteType" ADD VALUE 'cierre';
ALTER TYPE "NoteType" ADD VALUE 'reapertura';

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'esperando_aprobacion';

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "motivo" TEXT;

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "plan",
ADD COLUMN     "contrato" TEXT,
ADD COLUMN     "nit" TEXT,
ADD COLUMN     "razon_social" TEXT,
ADD COLUMN     "remotely_group_id" TEXT,
ADD COLUMN     "verificado" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "agent_hardened_at" TIMESTAMP(3),
ADD COLUMN     "agent_version" TEXT,
ADD COLUMN     "hw_battery" JSONB,
ADD COLUMN     "hw_board_info" JSONB,
ADD COLUMN     "hw_cpu" JSONB,
ADD COLUMN     "hw_graphics" JSONB,
ADD COLUMN     "hw_scanned_at" TIMESTAMP(3),
ADD COLUMN     "hw_serial_number" TEXT,
ADD COLUMN     "hw_storage" JSONB,
ADD COLUMN     "hw_storage_serials" TEXT[],
ADD COLUMN     "hw_usb_devices" JSONB,
ADD COLUMN     "hw_uuid" TEXT,
ADD COLUMN     "mac_addresses" TEXT[],
ADD COLUMN     "net_connections" JSONB,
ADD COLUMN     "net_interfaces" JSONB,
ADD COLUMN     "net_listening" JSONB,
ADD COLUMN     "net_scanned_at" TIMESTAMP(3),
ADD COLUMN     "ram_hardware_scanned_at" TIMESTAMP(3),
ADD COLUMN     "ram_modules" JSONB,
ADD COLUMN     "ram_slots_total" INTEGER,
ADD COLUMN     "ram_slots_used" INTEGER,
ADD COLUMN     "remotely_alias" TEXT,
ADD COLUMN     "remotely_group_id" TEXT,
ADD COLUMN     "remotely_group_name" TEXT,
ADD COLUMN     "remotely_id_hash" TEXT,
ADD COLUMN     "remotely_notes" TEXT,
ADD COLUMN     "remotely_tags" TEXT,
ADD COLUMN     "sw_apps" JSONB,
ADD COLUMN     "sw_scanned_at" TIMESTAMP(3),
ADD COLUMN     "sw_total_count" INTEGER;

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "adjuntos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "remotely_scripts_execution" DROP COLUMN "exit_code",
ADD COLUMN     "shell" TEXT,
ALTER COLUMN "script_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "categoria_id" TEXT,
ADD COLUMN     "criticidad" "TicketCriticidad" NOT NULL DEFAULT 'media',
ADD COLUMN     "primera_respuesta_en" TIMESTAMP(3),
ADD COLUMN     "reporter_email" TEXT,
ADD COLUMN     "reporter_nombre" TEXT,
ADD COLUMN     "reporter_telefono" TEXT,
ADD COLUMN     "sla_pausado_en" TIMESTAMP(3),
ADD COLUMN     "sla_resolucion_vence" TIMESTAMP(3),
ADD COLUMN     "sla_respuesta_vence" TIMESTAMP(3),
ADD COLUMN     "subcategoria_id" TEXT,
ADD COLUMN     "trabajo_iniciado_en" TIMESTAMP(3),
ALTER COLUMN "usuario_reporter_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nivel" INTEGER,
ADD COLUMN     "permisos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropEnum
DROP TYPE "CompanyPlan";

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "prioridad_default" "TicketPriority",
    "criticidad_default" "TicketCriticidad",
    "nivel_requerido" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_subcategories" (
    "id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "prioridad_default" "TicketPriority",
    "criticidad_default" "TicketCriticidad",
    "nivel_requerido" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "prioridad" "TicketPriority" NOT NULL,
    "criticidad" "TicketCriticidad" NOT NULL,
    "tiempo_respuesta_min" INTEGER NOT NULL,
    "tiempo_resolucion_min" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_level_visibility" (
    "id" TEXT NOT NULL,
    "nivel_tecnico" INTEGER NOT NULL,
    "nivel_ticket" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_level_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividades" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "ActividadTipo" NOT NULL DEFAULT 'otro',
    "estado" "ActividadEstado" NOT NULL DEFAULT 'pendiente',
    "empresa_id" TEXT NOT NULL,
    "usuario_asignado_id" TEXT,
    "ticket_id" TEXT,
    "dispositivo_id" TEXT,
    "fecha_planeada" TIMESTAMP(3),
    "fecha_completada" TIMESTAMP(3),
    "resultado" TEXT,
    "resultado_adjuntos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plantilla_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividad_plantillas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "ActividadTipo" NOT NULL DEFAULT 'otro',
    "empresa_id" TEXT NOT NULL,
    "usuario_asignado_id" TEXT,
    "dispositivo_id" TEXT,
    "recurrencia_tipo" "RecurrenciaTipo" NOT NULL,
    "recurrencia_dia" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultima_generacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actividad_plantillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividad_seguimientos" (
    "id" TEXT NOT NULL,
    "actividad_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividad_seguimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actas_entrega" (
    "id" TEXT NOT NULL,
    "actividad_id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "firma_nombre" TEXT NOT NULL,
    "firma_imagen" TEXT NOT NULL,
    "firmado_en" TIMESTAMP(3) NOT NULL,
    "pdf_path" TEXT,
    "enviado_a" TEXT,
    "enviado_en" TIMESTAMP(3),
    "creado_por_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actas_entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "link" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "remotely_server_url" TEXT,
    "remotely_api_key_id" TEXT,
    "remotely_api_key_secret" TEXT,
    "remotely_organization_id" TEXT,
    "remotely_package_hash" TEXT,
    "remotely_package_hash_checked_at" TIMESTAMP(3),
    "whatsapp_phone_number_id" TEXT,
    "whatsapp_business_account_id" TEXT,
    "whatsapp_access_token" TEXT,
    "whatsapp_app_secret" TEXT,
    "whatsapp_webhook_verify_token" TEXT,
    "whatsapp_configured_at" TIMESTAMP(3),
    "ai_provider" TEXT,
    "ai_model" TEXT,
    "ai_api_key" TEXT,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_system_prompt" TEXT,
    "email_provider" TEXT,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_user" TEXT,
    "smtp_password" TEXT,
    "smtp_from" TEXT,
    "smtp_secure" BOOLEAN,
    "default_company_id" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "arbol" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "chatbot_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_equipment" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "InventoryEquipmentType" NOT NULL,
    "nombre" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "numero_serie" TEXT,
    "ip_address" TEXT,
    "mac_address" TEXT,
    "ubicacion" TEXT,
    "proveedor" TEXT,
    "fecha_compra" TIMESTAMP(3),
    "garantia_vence" TIMESTAMP(3),
    "estado" "InventoryEquipmentStatus" NOT NULL DEFAULT 'activo',
    "credencial_usuario" TEXT,
    "credencial_password" TEXT,
    "notas_configuracion" TEXT,
    "notas" TEXT,
    "atributos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "razon" TEXT NOT NULL,
    "estado" "QuoteEstado" NOT NULL DEFAULT 'borrador',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creado_por_id" TEXT NOT NULL,
    "contacto_autorizador_id" TEXT,
    "ticketEstadoPrevio" "TicketStatus",
    "token_hash" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "resuelto_nombre" TEXT,
    "resuelto_ip" TEXT,
    "resuelto_user_agent" TEXT,
    "resuelto_en" TIMESTAMP(3),
    "firma_imagen" TEXT,
    "motivo_rechazo" TEXT,
    "pdf_path" TEXT,
    "documentos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "valor_unitario" DECIMAL(12,2) NOT NULL,
    "porcentaje_impuesto" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "canal" "ConversationChannel" NOT NULL DEFAULT 'web',
    "estado" "ConversationStatus" NOT NULL DEFAULT 'abierta',
    "contacto_nombre" TEXT NOT NULL,
    "contacto_email" TEXT,
    "contacto_telefono" TEXT,
    "token_hash" TEXT NOT NULL,
    "usuario_asignado_id" TEXT,
    "tiene_no_leidos" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_mensaje_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "remitente_tipo" "MessageSender" NOT NULL,
    "remitente_user_id" TEXT,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_channels" (
    "id" TEXT NOT NULL,
    "tipo" "TeamChannelType" NOT NULL,
    "nombre" TEXT,
    "created_by_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_channel_members" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ultima_lectura_en" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_messages" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_nombre_key" ON "ticket_categories"("nombre");

-- CreateIndex
CREATE INDEX "ticket_categories_activo_idx" ON "ticket_categories"("activo");

-- CreateIndex
CREATE INDEX "ticket_subcategories_categoria_id_idx" ON "ticket_subcategories"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_subcategories_categoria_id_nombre_key" ON "ticket_subcategories"("categoria_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_prioridad_criticidad_key" ON "sla_policies"("prioridad", "criticidad");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_level_visibility_nivel_tecnico_nivel_ticket_key" ON "ticket_level_visibility"("nivel_tecnico", "nivel_ticket");

-- CreateIndex
CREATE INDEX "actividades_empresa_id_idx" ON "actividades"("empresa_id");

-- CreateIndex
CREATE INDEX "actividades_usuario_asignado_id_idx" ON "actividades"("usuario_asignado_id");

-- CreateIndex
CREATE INDEX "actividades_estado_idx" ON "actividades"("estado");

-- CreateIndex
CREATE INDEX "actividades_fecha_planeada_idx" ON "actividades"("fecha_planeada");

-- CreateIndex
CREATE INDEX "actividades_plantilla_id_idx" ON "actividades"("plantilla_id");

-- CreateIndex
CREATE INDEX "actividad_plantillas_empresa_id_idx" ON "actividad_plantillas"("empresa_id");

-- CreateIndex
CREATE INDEX "actividad_plantillas_activo_idx" ON "actividad_plantillas"("activo");

-- CreateIndex
CREATE INDEX "actividad_seguimientos_actividad_id_idx" ON "actividad_seguimientos"("actividad_id");

-- CreateIndex
CREATE UNIQUE INDEX "actas_entrega_actividad_id_key" ON "actas_entrega"("actividad_id");

-- CreateIndex
CREATE INDEX "notifications_usuario_id_leida_idx" ON "notifications"("usuario_id", "leida");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_equipment_empresa_id_idx" ON "inventory_equipment"("empresa_id");

-- CreateIndex
CREATE INDEX "inventory_equipment_tipo_idx" ON "inventory_equipment"("tipo");

-- CreateIndex
CREATE INDEX "inventory_equipment_estado_idx" ON "inventory_equipment"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_token_hash_key" ON "quotes"("token_hash");

-- CreateIndex
CREATE INDEX "quotes_ticket_id_idx" ON "quotes"("ticket_id");

-- CreateIndex
CREATE INDEX "quotes_empresa_id_idx" ON "quotes"("empresa_id");

-- CreateIndex
CREATE INDEX "quotes_estado_idx" ON "quotes"("estado");

-- CreateIndex
CREATE INDEX "quote_line_items_quote_id_idx" ON "quote_line_items"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_token_hash_key" ON "conversations"("token_hash");

-- CreateIndex
CREATE INDEX "conversations_empresa_id_idx" ON "conversations"("empresa_id");

-- CreateIndex
CREATE INDEX "conversations_estado_idx" ON "conversations"("estado");

-- CreateIndex
CREATE INDEX "conversations_ultimo_mensaje_en_idx" ON "conversations"("ultimo_mensaje_en");

-- CreateIndex
CREATE INDEX "conversation_messages_conversation_id_createdAt_idx" ON "conversation_messages"("conversation_id", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "team_channel_members_channel_id_user_id_key" ON "team_channel_members"("channel_id", "user_id");

-- CreateIndex
CREATE INDEX "team_messages_channel_id_createdAt_idx" ON "team_messages"("channel_id", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "companies_nit_key" ON "companies"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "companies_remotely_group_id_key" ON "companies"("remotely_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_remotely_id_hash_key" ON "devices"("remotely_id_hash");

-- CreateIndex
CREATE INDEX "tickets_categoria_id_idx" ON "tickets"("categoria_id");

-- CreateIndex
CREATE INDEX "tickets_subcategoria_id_idx" ON "tickets"("subcategoria_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "ticket_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_subcategories" ADD CONSTRAINT "ticket_subcategories_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "ticket_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_usuario_asignado_id_fkey" FOREIGN KEY ("usuario_asignado_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "actividad_plantillas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_plantillas" ADD CONSTRAINT "actividad_plantillas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_plantillas" ADD CONSTRAINT "actividad_plantillas_usuario_asignado_id_fkey" FOREIGN KEY ("usuario_asignado_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_plantillas" ADD CONSTRAINT "actividad_plantillas_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_seguimientos" ADD CONSTRAINT "actividad_seguimientos_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_seguimientos" ADD CONSTRAINT "actividad_seguimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas_entrega" ADD CONSTRAINT "actas_entrega_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas_entrega" ADD CONSTRAINT "actas_entrega_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_equipment" ADD CONSTRAINT "inventory_equipment_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contacto_autorizador_id_fkey" FOREIGN KEY ("contacto_autorizador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_usuario_asignado_id_fkey" FOREIGN KEY ("usuario_asignado_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_remitente_user_id_fkey" FOREIGN KEY ("remitente_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_channels" ADD CONSTRAINT "team_channels_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_channel_members" ADD CONSTRAINT "team_channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_channel_members" ADD CONSTRAINT "team_channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

