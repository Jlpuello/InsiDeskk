-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "contacto_verificado" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "contacto_verificado" BOOLEAN NOT NULL DEFAULT true;
