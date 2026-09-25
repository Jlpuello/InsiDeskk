// Comandos de instalación del agente para una empresa. Windows lleva
// -DeviceGroup embebido (cae directo en el grupo/empresa correcta); Linux no
// lo soporta a nivel instalador — hay que asignar el grupo a mano después
// (limitación real de Remotely, confirmada contra su código fuente).
export interface AgentScriptInfo {
  companyId: string;
  companyName: string;
  // null = sin grupo de Remotely mapeado — el instalador funciona igual,
  // solo queda sin grupo asignado hasta organizarlo a mano en Remotely.
  groupName: string | null;
  windows: {
    command: string;
    batContent: string;
  };
  linux: {
    ubuntu: string;
    manjaro: string;
  };
}
