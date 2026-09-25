import ExcelJS from 'exceljs';
import type { Device, InventoryEquipment } from '@prisma/client';

const TIPO_LABELS: Record<string, string> = {
  router: 'Router',
  switch: 'Switch',
  access_point: 'Access Point',
  impresora: 'Impresora',
  dvr: 'DVR',
  camara_ip: 'Cámara IP',
  control_acceso: 'Control de acceso',
};

const ESTADO_LABELS: Record<string, string> = {
  activo: 'Activo',
  en_reparacion: 'En reparación',
  dado_de_baja: 'Dado de baja',
};

const DEVICE_ESTADO_LABELS: Record<string, string> = {
  online: 'En línea',
  offline: 'Fuera de línea',
  inactivo: 'Inactivo',
};

type EquipmentWithEmpresa = InventoryEquipment & { empresa?: { nombre: string } | null };
type DeviceWithEmpresa = Device & { empresa?: { nombre: string } | null };

function headerRow(sheet: ExcelJS.Worksheet): void {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

// Deliberadamente NO incluye credencialUsuario/credencialPassword/
// notasConfiguracion: un archivo exportado puede terminar en un correo, una
// carpeta compartida o un USB — esas credenciales solo se ven dentro del
// sistema (ver InventoryDetail en el frontend), nunca en un archivo que sale
// de él (misma decisión aplicada en el PDF individual, ver InventoryReport).
function addEquipmentSheet(workbook: ExcelJS.Workbook, equipment: EquipmentWithEmpresa[]): void {
  const sheet = workbook.addWorksheet('Equipo de red y seguridad');
  sheet.columns = [
    { header: 'Empresa', key: 'empresa', width: 24 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Nombre', key: 'nombre', width: 24 },
    { header: 'Marca', key: 'marca', width: 16 },
    { header: 'Modelo', key: 'modelo', width: 18 },
    { header: 'N° de serie', key: 'numeroSerie', width: 20 },
    { header: 'IP', key: 'ipAddress', width: 16 },
    { header: 'MAC', key: 'macAddress', width: 18 },
    { header: 'Ubicación', key: 'ubicacion', width: 20 },
    { header: 'Proveedor', key: 'proveedor', width: 20 },
    { header: 'Fecha de compra', key: 'fechaCompra', width: 16 },
    { header: 'Garantía vence', key: 'garantiaVence', width: 16 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Notas', key: 'notas', width: 30 },
  ];
  headerRow(sheet);

  for (const item of equipment) {
    sheet.addRow({
      empresa: item.empresa?.nombre ?? '',
      tipo: TIPO_LABELS[item.tipo] ?? item.tipo,
      nombre: item.nombre,
      marca: item.marca ?? '',
      modelo: item.modelo ?? '',
      numeroSerie: item.numeroSerie ?? '',
      ipAddress: item.ipAddress ?? '',
      macAddress: item.macAddress ?? '',
      ubicacion: item.ubicacion ?? '',
      proveedor: item.proveedor ?? '',
      fechaCompra: item.fechaCompra ? item.fechaCompra.toISOString().slice(0, 10) : '',
      garantiaVence: item.garantiaVence ? item.garantiaVence.toISOString().slice(0, 10) : '',
      estado: ESTADO_LABELS[item.estado] ?? item.estado,
      notas: item.notas ?? '',
    });
  }
}

// "Datos disponibles" responde directamente a qué escaneos corrió el agente
// en ese PC — hardware/software/red no son automáticos, son bajo demanda
// (ver DeviceDetail en el frontend), así que un PC recién registrado puede
// no tener ninguno todavía.
function datosDisponibles(device: Device): string {
  const disponibles: string[] = [];
  if (device.hwScannedAt) disponibles.push('Hardware');
  if (device.swScannedAt) disponibles.push('Software');
  if (device.netScannedAt) disponibles.push('Red');
  return disponibles.length > 0 ? disponibles.join(', ') : 'Sin escanear';
}

function addDeviceSheet(workbook: ExcelJS.Workbook, devices: DeviceWithEmpresa[]): void {
  const sheet = workbook.addWorksheet('PCs (agente)');
  sheet.columns = [
    { header: 'Empresa', key: 'empresa', width: 24 },
    { header: 'Nombre', key: 'nombre', width: 22 },
    { header: 'Hostname', key: 'hostname', width: 20 },
    { header: 'SO', key: 'so', width: 12 },
    { header: 'Versión SO', key: 'versionSo', width: 14 },
    { header: 'CPU (núcleos)', key: 'cpuCores', width: 12 },
    { header: 'RAM (GB)', key: 'ramGb', width: 10 },
    { header: 'Disco (GB)', key: 'discoGb', width: 10 },
    { header: 'IP local', key: 'ipLocal', width: 16 },
    { header: 'N° de serie', key: 'hwSerialNumber', width: 20 },
    { header: 'Grupo', key: 'remotelyGroupName', width: 18 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Datos disponibles', key: 'datosDisponibles', width: 22 },
    { header: 'Versión agente', key: 'agentVersion', width: 14 },
  ];
  headerRow(sheet);

  for (const device of devices) {
    sheet.addRow({
      empresa: device.empresa?.nombre ?? '',
      nombre: device.nombre,
      hostname: device.hostname ?? '',
      so: device.so ?? '',
      versionSo: device.versionSo ?? '',
      cpuCores: device.cpuCores ?? '',
      ramGb: device.ramGb ?? '',
      discoGb: device.discoGb ?? '',
      ipLocal: device.ipLocal ?? '',
      hwSerialNumber: device.hwSerialNumber ?? '',
      remotelyGroupName: device.remotelyGroupName ?? '',
      estado: DEVICE_ESTADO_LABELS[device.estado] ?? device.estado,
      datosDisponibles: datosDisponibles(device),
      agentVersion: device.agentVersion ?? '',
    });
  }
}

// `null` en equipment/devices significa "esta hoja no aplica" (el filtro de
// tipo pidió explícitamente el otro lado) — a diferencia de `[]` (aplica,
// pero no hay resultados), que sí genera la hoja vacía con encabezados.
export async function buildInventoryWorkbook(input: {
  equipment: EquipmentWithEmpresa[] | null;
  devices: DeviceWithEmpresa[] | null;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InsiDesk';
  workbook.created = new Date();

  if (input.equipment !== null) addEquipmentSheet(workbook, input.equipment);
  if (input.devices !== null) addDeviceSheet(workbook, input.devices);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
