-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "conectado_a_id" TEXT;

-- AlterTable
ALTER TABLE "inventory_equipment" ADD COLUMN     "conectado_a_id" TEXT;

-- CreateIndex
CREATE INDEX "devices_conectado_a_id_idx" ON "devices"("conectado_a_id");

-- CreateIndex
CREATE INDEX "inventory_equipment_conectado_a_id_idx" ON "inventory_equipment"("conectado_a_id");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_conectado_a_id_fkey" FOREIGN KEY ("conectado_a_id") REFERENCES "inventory_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_equipment" ADD CONSTRAINT "inventory_equipment_conectado_a_id_fkey" FOREIGN KEY ("conectado_a_id") REFERENCES "inventory_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
