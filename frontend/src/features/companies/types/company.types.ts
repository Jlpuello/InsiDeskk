export interface Company {
  id: string;
  nombre: string;
  razonSocial?: string | null;
  nit?: string | null;
  emailContacto?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  contrato?: string | null;
  activo: boolean;
  // false = autogenerada por la landing pública de soporte (NIT sin empresa
  // registrada) — ver companyService.resolveOrProvisionByNit en el backend.
  verificado: boolean;
  // Grupo de Remotely asociado (Device.remotelyGroupId) — así los equipos de
  // ese grupo se dan de alta/reasignan solos bajo esta empresa.
  remotelyGroupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyFormInput {
  nombre: string;
  razonSocial?: string;
  nit?: string;
  emailContacto?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais?: string;
  contrato?: string;
  remotelyGroupId?: string | null;
}
