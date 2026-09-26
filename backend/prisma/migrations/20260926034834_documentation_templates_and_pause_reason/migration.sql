-- CreateEnum
CREATE TYPE "DocumentationTemplateContext" AS ENUM ('cierre_ticket', 'completar_actividad', 'motivo_pausa');

-- AlterEnum
ALTER TYPE "NoteType" ADD VALUE 'pausa';

-- CreateTable
CREATE TABLE "documentation_templates" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "contextos" "DocumentationTemplateContext"[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_templates_pkey" PRIMARY KEY ("id")
);

