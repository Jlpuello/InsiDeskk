-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "glpi_agent_tag" TEXT;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "glpi_device_id" TEXT,
ADD COLUMN     "glpi_device_id_hash" TEXT,
ADD COLUMN     "glpi_tag" TEXT,
ADD COLUMN     "ultimo_inventario_glpi" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "companies_glpi_agent_tag_key" ON "companies"("glpi_agent_tag");

-- CreateIndex
CREATE UNIQUE INDEX "devices_glpi_device_id_hash_key" ON "devices"("glpi_device_id_hash");
